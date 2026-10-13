import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { GenerationTaskEntity } from '../entities/generation-task.entity';
import { GenerationResultEntity } from '../entities/generation-result.entity';
import { StoryVersionEntity } from '../../story/entities/story-version.entity';
import { StorySceneEntity } from '../../storyboard/entities/story-scene.entity';
import { LlmProviderService } from '../../provider/adapters/llm-provider.service';
import { ProviderConfigService } from '../../provider/provider-config.service';
import { TemplateService } from '../../template/template.service';
import { BillingService } from '../../billing/billing.service';
import { AuditService } from '../../audit/audit.service';
import { NonRetryableError } from '../../../common/errors/non-retryable.error';

@Processor('scene_generate')
export class SceneProcessor extends WorkerHost {
  constructor(
    @InjectRepository(GenerationTaskEntity)
    private readonly taskRepo: Repository<GenerationTaskEntity>,
    @InjectRepository(GenerationResultEntity)
    private readonly resultRepo: Repository<GenerationResultEntity>,
    @InjectRepository(StoryVersionEntity)
    private readonly storyVersionRepo: Repository<StoryVersionEntity>,
    @InjectRepository(StorySceneEntity)
    private readonly sceneRepo: Repository<StorySceneEntity>,
    @InjectQueue('prompt_generate')
    private readonly promptQueue: Queue,
    private readonly llmProviderService: LlmProviderService,
    private readonly providerConfigService: ProviderConfigService,
    private readonly templateService: TemplateService,
    private readonly billingService: BillingService,
    private readonly auditService: AuditService
  ) {
    super();
  }

  async process(job: Job) {
    const startedAt = Date.now();
    const { taskId, storyVersionId, workspaceId } = job.data as {
      taskId: number;
      storyVersionId: number;
      workspaceId: number;
    };

    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) return;

    try {
      await this.taskRepo.update(taskId, { status: TaskStatus.RUNNING });

      const storyVersion = await this.storyVersionRepo.findOne({ where: { id: storyVersionId } });
      if (!storyVersion) {
        throw new Error('story version not found');
      }

      const providerCfg = await this.providerConfigService.getTextProviderConfig(workspaceId);
      const templateOverride = await this.templateService.renderPublishedOverride(
        workspaceId,
        'SCENE_GENERATION',
        { storyContent: storyVersion.content }
      );

      const generatedScenes = await this.llmProviderService.generateScenes(
        storyVersion.content,
        providerCfg ?? undefined,
        templateOverride ?? undefined
      );
      const savedSceneIds: number[] = [];

      for (const scene of generatedScenes) {
        const savedScene = await this.sceneRepo.save(
          this.sceneRepo.create({
            storyVersionId,
            sceneNo: scene.sceneNo,
            sceneDesc: scene.sceneDesc,
            characterAction: scene.characterAction,
            narration: scene.narration
          })
        );
        savedSceneIds.push(savedScene.id);

        const promptTask = await this.taskRepo.save(
          this.taskRepo.create({
            workspaceId,
            taskType: 'prompt',
            bizId: savedScene.id,
            status: TaskStatus.PENDING,
            retryCount: 0,
            maxRetry: 3,
            idempotencyKey: `prompt:${savedScene.id}:v1`,
            payloadJson: JSON.stringify({})
          })
        );

        await this.promptQueue.add(
          'prompt.generate',
          {
            taskId: promptTask.id,
            sceneId: savedScene.id,
            workspaceId
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 30000 }
          }
        );
      }

      await this.taskRepo.update(taskId, { status: TaskStatus.SUCCESS });

      // 记录可观测结果
      const result = await this.resultRepo.save(
        this.resultRepo.create({
          taskId,
          providerName: 'builtin-provider',
          modelName: 'builtin-scene-generator',
          responsePayloadJson: JSON.stringify({ storyVersionId, sceneIds: savedSceneIds }),
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
        detail: { taskType: 'scene' }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      if (err instanceof NonRetryableError) {
        await this.taskRepo.update(taskId, {
          status: TaskStatus.FAILED,
          errorCode: err.code ?? '4102',
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
        errorCode: '4002',
        errorMessage: message.slice(0, 2000)
      });

      await this.auditService.record({
        workspaceId,
        action: 'TASK_FAILED',
        targetType: 'generation_task',
        targetId: String(taskId),
        detail: {
          errorCode: '4002',
          status
        }
      });

      throw err;
    }
  }
}
