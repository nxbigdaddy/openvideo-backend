import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { WorkspaceMemberEntity } from '../auth/entities/workspace-member.entity';
import { StoryEntity } from '../story/entities/story.entity';
import { StoryVersionEntity } from '../story/entities/story-version.entity';
import { StorySceneEntity } from '../storyboard/entities/story-scene.entity';
import { ScenePromptEntity } from './entities/scene-prompt.entity';
import { UpdateScenePromptDto } from './dto/update-scene-prompt.dto';
import { GenerationTaskEntity } from '../job/entities/generation-task.entity';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { StoryStatus } from '../../common/enums/story-status.enum';

@Injectable()
export class PromptService {
  constructor(
    @InjectRepository(ScenePromptEntity)
    private readonly promptRepo: Repository<ScenePromptEntity>,
    @InjectRepository(StorySceneEntity)
    private readonly sceneRepo: Repository<StorySceneEntity>,
    @InjectRepository(StoryVersionEntity)
    private readonly storyVersionRepo: Repository<StoryVersionEntity>,
    @InjectRepository(StoryEntity)
    private readonly storyRepo: Repository<StoryEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepo: Repository<WorkspaceMemberEntity>,
    @InjectRepository(GenerationTaskEntity)
    private readonly taskRepo: Repository<GenerationTaskEntity>,
    private readonly auditService: AuditService,
    @InjectQueue('image_generate')
    private readonly imageQueue: Queue
  ) {}

  private async ensureMember(userId: number, workspaceId: number) {
    const row = await this.memberRepo.findOne({ where: { userId, workspaceId, isActive: true } });
    if (!row) throw new ForbiddenException('no workspace access');
  }

  async updateScenePrompt(promptId: number, userId: number, dto: UpdateScenePromptDto) {
    const prompt = await this.promptRepo.findOne({ where: { id: promptId } });
    if (!prompt) throw new NotFoundException('scene prompt not found');

    const scene = await this.sceneRepo.findOne({ where: { id: prompt.sceneId } });
    if (!scene) throw new NotFoundException('scene not found');

    const storyVersion = await this.storyVersionRepo.findOne({ where: { id: scene.storyVersionId } });
    if (!storyVersion) throw new NotFoundException('story version not found');

    const story = await this.storyRepo.findOne({ where: { id: storyVersion.storyId } });
    if (!story) throw new NotFoundException('story not found');

    await this.ensureMember(userId, story.workspaceId);

    // Editing prompts invalidates previously generated images.
    const next = {
      positivePrompt: dto.positivePrompt ?? prompt.positivePrompt,
      negativePrompt: dto.negativePrompt ?? prompt.negativePrompt,
      paramsJson: dto.paramsJson ?? prompt.paramsJson,
      status: dto.status ?? 'edited',
      imageStatus: 'none' as const,
      imageUrl: undefined,
      imageB64Json: undefined,
      imageProviderName: undefined,
      imageModelName: undefined,
      imageTaskId: undefined
    };

    await this.promptRepo.update(promptId, next);
    const updated = await this.promptRepo.findOne({ where: { id: promptId } });

    await this.auditService.record({
      workspaceId: story.workspaceId,
      operatorUserId: userId,
      action: 'SCENE_PROMPT_UPDATE',
      targetType: 'scene_prompt',
      targetId: String(promptId),
      detail: { status: updated?.status ?? next.status }
    });

    return updated;
  }

  async approveScenePrompt(promptId: number, userId: number) {
    const prompt = await this.promptRepo.findOne({ where: { id: promptId } });
    if (!prompt) throw new NotFoundException('scene prompt not found');

    const scene = await this.sceneRepo.findOne({ where: { id: prompt.sceneId } });
    if (!scene) throw new NotFoundException('scene not found');

    const storyVersion = await this.storyVersionRepo.findOne({ where: { id: scene.storyVersionId } });
    if (!storyVersion) throw new NotFoundException('story version not found');

    const story = await this.storyRepo.findOne({ where: { id: storyVersion.storyId } });
    if (!story) throw new NotFoundException('story not found');

    await this.ensureMember(userId, story.workspaceId);

    await this.promptRepo.update(promptId, {
      status: 'approved'
    });

    const updated = await this.promptRepo.findOne({ where: { id: promptId } });
    await this.auditService.record({
      workspaceId: story.workspaceId,
      operatorUserId: userId,
      action: 'SCENE_PROMPT_APPROVE',
      targetType: 'scene_prompt',
      targetId: String(promptId),
      detail: { status: updated?.status }
    });

    // 如果 story 未进入发布态，则不触发图片生产
    if (story.status !== StoryStatus.APPROVED) return updated;

    // 已有图片则不重复入队
    if (updated?.imageStatus === 'generated' && updated?.imageUrl) return updated;

    const imageTask = await this.taskRepo.save(
      this.taskRepo.create({
        workspaceId: story.workspaceId,
        taskType: 'image',
        bizId: updated!.id,
        status: TaskStatus.PENDING,
        retryCount: 0,
        maxRetry: 3,
        idempotencyKey: `image:${updated!.id}:v1`,
        payloadJson: JSON.stringify({})
      })
    );

    await this.imageQueue.add(
      'image.generate',
      {
        taskId: imageTask.id,
        scenePromptId: updated!.id,
        workspaceId: story.workspaceId
      },
      { jobId: `image:${imageTask.id}:${Date.now()}`, attempts: 3, backoff: { type: 'exponential', delay: 30000 } }
    );

    return { prompt: updated, queuedImageTaskId: imageTask.id };
  }

  async rejectScenePrompt(promptId: number, userId: number, reason?: string) {
    const prompt = await this.promptRepo.findOne({ where: { id: promptId } });
    if (!prompt) throw new NotFoundException('scene prompt not found');

    const scene = await this.sceneRepo.findOne({ where: { id: prompt.sceneId } });
    if (!scene) throw new NotFoundException('scene not found');

    const storyVersion = await this.storyVersionRepo.findOne({ where: { id: scene.storyVersionId } });
    if (!storyVersion) throw new NotFoundException('story version not found');

    const story = await this.storyRepo.findOne({ where: { id: storyVersion.storyId } });
    if (!story) throw new NotFoundException('story not found');

    await this.ensureMember(userId, story.workspaceId);

    await this.promptRepo.update(promptId, {
      status: 'rejected',
      imageStatus: 'none',
      imageUrl: undefined,
      imageB64Json: undefined,
      imageProviderName: undefined,
      imageModelName: undefined,
      imageTaskId: undefined
    });

    const updated = await this.promptRepo.findOne({ where: { id: promptId } });
    await this.auditService.record({
      workspaceId: story.workspaceId,
      operatorUserId: userId,
      action: 'SCENE_PROMPT_REJECT',
      targetType: 'scene_prompt',
      targetId: String(promptId),
      detail: { reason: reason ?? null, status: updated?.status }
    });
    return updated;
  }

  async getScenePrompt(promptId: number, userId: number) {
    const prompt = await this.promptRepo.findOne({ where: { id: promptId } });
    if (!prompt) throw new NotFoundException('scene prompt not found');

    const scene = await this.sceneRepo.findOne({ where: { id: prompt.sceneId } });
    if (!scene) throw new NotFoundException('scene not found');

    const storyVersion = await this.storyVersionRepo.findOne({ where: { id: scene.storyVersionId } });
    if (!storyVersion) throw new NotFoundException('story version not found');

    const story = await this.storyRepo.findOne({ where: { id: storyVersion.storyId } });
    if (!story) throw new NotFoundException('story not found');

    await this.ensureMember(userId, story.workspaceId);
    return prompt;
  }
}
