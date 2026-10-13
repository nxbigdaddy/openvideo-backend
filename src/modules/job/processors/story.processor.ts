import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { GenerationResultEntity } from '../entities/generation-result.entity';
import { GenerationTaskEntity } from '../entities/generation-task.entity';
import { StoryEntity } from '../../story/entities/story.entity';
import { StoryVersionEntity } from '../../story/entities/story-version.entity';
import { StoryStatus } from '../../../common/enums/story-status.enum';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LlmProviderService } from '../../provider/adapters/llm-provider.service';
import { ProviderConfigService } from '../../provider/provider-config.service';
import { TemplateService } from '../../template/template.service';
import { BillingService } from '../../billing/billing.service';
import { AuditService } from '../../audit/audit.service';
import { NonRetryableError } from '../../../common/errors/non-retryable.error';

@Processor('story_generate')
export class StoryProcessor extends WorkerHost {
  constructor(
    @InjectRepository(GenerationTaskEntity)
    private readonly taskRepo: Repository<GenerationTaskEntity>,
    @InjectRepository(GenerationResultEntity)
    private readonly resultRepo: Repository<GenerationResultEntity>,
    @InjectRepository(StoryEntity)
    private readonly storyRepo: Repository<StoryEntity>,
    @InjectRepository(StoryVersionEntity)
    private readonly storyVersionRepo: Repository<StoryVersionEntity>,
    @InjectQueue('scene_generate')
    private readonly sceneQueue: Queue,
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
    const { taskId, storyId, workspaceId, options } = job.data as {
      taskId: number;
      storyId: number;
      workspaceId: number;
      options: { targetLength: number; style: string; audience: string; language: string };
    };

    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) return;

    try {
      await this.taskRepo.update(taskId, { status: TaskStatus.RUNNING });

      const story = await this.storyRepo.findOne({ where: { id: storyId } });
      if (!story) {
        throw new Error('story not found');
      }

      const providerCfg = await this.providerConfigService.getTextProviderConfig(workspaceId);
      const templateOverride = await this.templateService.renderPublishedOverride(workspaceId, 'STORY_GENERATION', {
        title: story.title,
        targetLength: options.targetLength,
        style: options.style,
        audience: options.audience,
        language: options.language
      });

      const generated = await this.llmProviderService.generateStory(
        {
        title: story.title,
        targetLength: options.targetLength,
        style: options.style,
        audience: options.audience,
        language: options.language
        },
        providerCfg ?? undefined,
        templateOverride ?? undefined
      );

      const version = await this.storyVersionRepo.save(
        this.storyVersionRepo.create({
          storyId: story.id,
          title: generated.title,
          summary: generated.summary,
          content: generated.content,
          style: options.style,
          audience: options.audience,
          targetLength: options.targetLength,
          versionNo: 1
        })
      );

      await this.storyRepo.update(story.id, {
        currentVersionId: version.id,
        status: StoryStatus.GENERATED
      });

      const result = await this.resultRepo.save(
        this.resultRepo.create({
          taskId,
          providerName: 'builtin-provider',
          modelName: 'builtin-story-generator',
          responsePayloadJson: JSON.stringify(generated),
          tokenInput: 120,
          tokenOutput: 420,
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
        detail: { taskType: 'story' }
      });

      await this.taskRepo.update(taskId, { status: TaskStatus.SUCCESS });

      const sceneTask = await this.taskRepo.save(
        this.taskRepo.create({
          workspaceId,
          taskType: 'scene',
          bizId: version.id,
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetry: 3,
          idempotencyKey: `scene:${version.id}:v1`,
          payloadJson: JSON.stringify({})
        })
      );

      await this.sceneQueue.add(
        'scene.generate',
        {
          taskId: sceneTask.id,
          storyVersionId: version.id,
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
          errorCode: err.code ?? '4101',
          errorMessage: message.slice(0, 2000)
        });
        return;
      }
      const attempts = (job.opts.attempts ?? task.maxRetry ?? 3) as number;
      const nextAttempt = (job.attemptsMade ?? 0) + 1;
      const willExceed = nextAttempt >= attempts;
      const status = willExceed ? TaskStatus.DEAD_LETTER : TaskStatus.RETRYING;

      await this.taskRepo.update(taskId, {
        status,
        errorCode: '4001',
        errorMessage: message.slice(0, 2000)
      });

      await this.auditService.record({
        workspaceId,
        action: 'TASK_FAILED',
        targetType: 'generation_task',
        targetId: String(taskId),
        detail: {
          errorCode: '4001',
          status
        }
      });

      // Throw to let BullMQ apply retry attempts/backoff automatically.
      throw err;
    }
  }
}
