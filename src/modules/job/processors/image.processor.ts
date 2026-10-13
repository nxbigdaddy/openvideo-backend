import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { GenerationTaskEntity } from '../entities/generation-task.entity';
import { GenerationResultEntity } from '../entities/generation-result.entity';
import { ScenePromptEntity } from '../../prompt/entities/scene-prompt.entity';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { LlmProviderService } from '../../provider/adapters/llm-provider.service';
import { ProviderConfigService } from '../../provider/provider-config.service';
import { BillingService } from '../../billing/billing.service';
import { AuditService } from '../../audit/audit.service';
import { NonRetryableError } from '../../../common/errors/non-retryable.error';
import { StorySceneEntity } from '../../storyboard/entities/story-scene.entity';
import { StoryVersionEntity } from '../../story/entities/story-version.entity';
import { StoryEntity } from '../../story/entities/story.entity';
import { StoryStatus } from '../../../common/enums/story-status.enum';

@Processor('image_generate')
export class ImageProcessor extends WorkerHost {
  constructor(
    @InjectRepository(GenerationTaskEntity)
    private readonly taskRepo: Repository<GenerationTaskEntity>,
    @InjectRepository(GenerationResultEntity)
    private readonly resultRepo: Repository<GenerationResultEntity>,
    @InjectRepository(ScenePromptEntity)
    private readonly scenePromptRepo: Repository<ScenePromptEntity>,
    @InjectRepository(StorySceneEntity)
    private readonly sceneRepo: Repository<StorySceneEntity>,
    @InjectRepository(StoryVersionEntity)
    private readonly storyVersionRepo: Repository<StoryVersionEntity>,
    @InjectRepository(StoryEntity)
    private readonly storyRepo: Repository<StoryEntity>,
    private readonly llmProviderService: LlmProviderService,
    private readonly providerConfigService: ProviderConfigService,
    private readonly billingService: BillingService,
    private readonly auditService: AuditService
  ) {
    super();
  }

  async process(job: Job) {
    const startedAt = Date.now();
    const { taskId, scenePromptId, workspaceId } = job.data as {
      taskId: number;
      scenePromptId: number;
      workspaceId: number;
    };

    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) return;

    try {
      await this.taskRepo.update(taskId, { status: TaskStatus.RUNNING });

      const scenePrompt = await this.scenePromptRepo.findOne({ where: { id: scenePromptId } });
      if (!scenePrompt) {
        throw new Error('scene prompt not found');
      }

      const scene = await this.sceneRepo.findOne({ where: { id: scenePrompt.sceneId } });
      if (!scene) throw new Error('scene not found');

      const storyVersion = await this.storyVersionRepo.findOne({ where: { id: scene.storyVersionId } });
      if (!storyVersion) throw new Error('story version not found');

      const story = await this.storyRepo.findOne({ where: { id: storyVersion.storyId } });
      if (!story) throw new Error('story not found');

      // 如果故事被驳回，则不再生产图片，避免浪费成本与输出不一致内容
      if (story.status === StoryStatus.REJECTED) {
        throw new NonRetryableError('story rejected, skip image generation', '4201');
      }

      const imageProviderCfg = await this.providerConfigService.getImageProviderConfig(workspaceId);

      const image = await this.llmProviderService.generateImage(
        scenePrompt.positivePrompt,
        scenePrompt.negativePrompt,
        scenePrompt.paramsJson,
        imageProviderCfg ?? undefined
      );

      const imageProviderName = imageProviderCfg?.providerName ?? 'image-provider';
      const imageModelName = imageProviderCfg?.modelName ?? 'mock-image-generator';

      const result = await this.resultRepo.save(
        this.resultRepo.create({
          taskId,
          providerName: imageProviderName,
          modelName: imageModelName,
          responsePayloadJson: JSON.stringify(image),
          tokenInput: 0,
          tokenOutput: 0,
          elapsedMs: Date.now() - startedAt
        })
      );

      await this.scenePromptRepo.update(scenePrompt.id, {
        imageStatus: 'generated',
        imageUrl: image.imageUrl,
        imageB64Json: image.b64Json,
        imageProviderName,
        imageModelName,
        imageTaskId: taskId
      });

      await this.billingService.recordFromResult({
        workspaceId,
        taskId,
        providerType: 'image',
        result
      });

      await this.auditService.record({
        workspaceId,
        action: 'TASK_SUCCESS',
        targetType: 'generation_task',
        targetId: String(taskId),
        detail: { taskType: 'image' }
      });

      await this.taskRepo.update(taskId, { status: TaskStatus.SUCCESS });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      if (err instanceof NonRetryableError) {
        await this.taskRepo.update(taskId, {
          status: TaskStatus.FAILED,
          errorCode: err.code ?? '4104',
          errorMessage: message.slice(0, 2000)
        });

        await this.scenePromptRepo.update(scenePromptId, {
          imageStatus: 'failed'
        });

        await this.auditService.record({
          workspaceId,
          action: 'TASK_FAILED',
          targetType: 'generation_task',
          targetId: String(taskId),
          detail: { errorCode: err.code, nonRetryable: true }
        });
        return;
      }
      const attempts = (job.opts.attempts ?? task.maxRetry ?? 3) as number;
      const nextAttempt = (job.attemptsMade ?? 0) + 1;
      const willExceed = nextAttempt >= attempts;
      const status = willExceed ? TaskStatus.DEAD_LETTER : TaskStatus.RETRYING;

      await this.taskRepo.update(taskId, {
        status,
        errorCode: '4004',
        errorMessage: message.slice(0, 2000)
      });

      await this.auditService.record({
        workspaceId,
        action: 'TASK_FAILED',
        targetType: 'generation_task',
        targetId: String(taskId),
        detail: { errorCode: '4004', status }
      });

      throw err;
    }
  }
}

