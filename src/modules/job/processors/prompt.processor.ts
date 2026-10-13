import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { GenerationTaskEntity } from '../entities/generation-task.entity';
import { GenerationResultEntity } from '../entities/generation-result.entity';
import { StorySceneEntity } from '../../storyboard/entities/story-scene.entity';
import { ScenePromptEntity } from '../../prompt/entities/scene-prompt.entity';
import { LlmProviderService } from '../../provider/adapters/llm-provider.service';
import { ProviderConfigService } from '../../provider/provider-config.service';
import { TemplateService } from '../../template/template.service';
import { BillingService } from '../../billing/billing.service';
import { AuditService } from '../../audit/audit.service';
import { NonRetryableError } from '../../../common/errors/non-retryable.error';

@Processor('prompt_generate')
export class PromptProcessor extends WorkerHost {
  constructor(
    @InjectRepository(GenerationTaskEntity)
    private readonly taskRepo: Repository<GenerationTaskEntity>,
    @InjectRepository(GenerationResultEntity)
    private readonly resultRepo: Repository<GenerationResultEntity>,
    @InjectRepository(StorySceneEntity)
    private readonly sceneRepo: Repository<StorySceneEntity>,
    @InjectRepository(ScenePromptEntity)
    private readonly promptRepo: Repository<ScenePromptEntity>,
    private readonly llmProviderService: LlmProviderService,
    private readonly providerConfigService: ProviderConfigService,
    private readonly templateService: TemplateService,
    private readonly billingService: BillingService,
    private readonly auditService: AuditService,
    @InjectQueue('image_generate')
    private readonly imageQueue: Queue
  ) {
    super();
  }

  async process(job: Job) {
    const startedAt = Date.now();
    const { taskId, sceneId, workspaceId } = job.data as {
      taskId: number;
      sceneId: number;
      workspaceId: number;
    };

    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) return;

    try {
      await this.taskRepo.update(taskId, { status: TaskStatus.RUNNING });

      const scene = await this.sceneRepo.findOne({ where: { id: sceneId } });
      if (!scene) {
        throw new Error('scene not found');
      }

      const providerCfg = await this.providerConfigService.getTextProviderConfig(workspaceId);
      const templateOverride = await this.templateService.renderPublishedOverride(
        workspaceId,
        'IMAGE_PROMPT_GENERATION',
        {
          sceneDesc: scene.sceneDesc,
          characterAction: scene.characterAction ?? ''
        }
      );

      const prompt = await this.llmProviderService.generatePrompt(
        scene.sceneDesc,
        scene.characterAction ?? '',
        providerCfg ?? undefined,
        templateOverride ?? undefined
      );

      const savedPrompt = await this.promptRepo.save(
        this.promptRepo.create({
          sceneId,
          promptVersion: 1,
          positivePrompt: prompt.positivePrompt,
          negativePrompt: prompt.negativePrompt,
          paramsJson: prompt.paramsJson,
          status: 'generated'
        })
      );

      await this.taskRepo.update(taskId, { status: TaskStatus.SUCCESS });

      const result = await this.resultRepo.save(
        this.resultRepo.create({
          taskId,
          providerName: 'builtin-provider',
          modelName: 'builtin-image-prompt-generator',
          responsePayloadJson: JSON.stringify({ sceneId }),
          tokenInput: 0,
          tokenOutput: 0,
          elapsedMs: Date.now() - startedAt
        })
      );
      await this.billingService.recordFromResult({
        workspaceId,
        taskId,
        providerType: 'text',
        result
      });

      await this.auditService.record({
        workspaceId,
        action: 'TASK_SUCCESS',
        targetType: 'generation_task',
        targetId: String(taskId),
        detail: { taskType: 'prompt' }
      });

      // Prompt生成完成后，自动创建图像生成任务
      const imageTask = await this.taskRepo.save(
        this.taskRepo.create({
          workspaceId,
          taskType: 'image',
          bizId: savedPrompt.id,
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetry: 3,
          idempotencyKey: `image:${savedPrompt.id}:v1`,
          payloadJson: JSON.stringify({})
        })
      );

      await this.imageQueue.add(
        'image.generate',
        {
          taskId: imageTask.id,
          scenePromptId: savedPrompt.id,
          workspaceId
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30000 }
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      if (err instanceof NonRetryableError) {
        await this.taskRepo.update(taskId, {
          status: TaskStatus.FAILED,
          errorCode: err.code ?? '4103',
          errorMessage: message.slice(0, 2000)
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
        errorCode: '4003',
        errorMessage: message.slice(0, 2000)
      });

      await this.auditService.record({
        workspaceId,
        action: 'TASK_FAILED',
        targetType: 'generation_task',
        targetId: String(taskId),
        detail: {
          errorCode: '4003',
          status
        }
      });

      throw err;
    }
  }
}
