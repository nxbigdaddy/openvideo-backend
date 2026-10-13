import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { GenerationTaskEntity } from '../job/entities/generation-task.entity';
import { BatchGenerateStoryDto } from './dto/batch-generate-story.dto';
import { StoryEntity } from './entities/story.entity';
import { StoryVersionEntity } from './entities/story-version.entity';
import { StorySceneEntity } from '../storyboard/entities/story-scene.entity';
import { ScenePromptEntity } from '../prompt/entities/scene-prompt.entity';
import { WorkspaceMemberEntity } from '../auth/entities/workspace-member.entity';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { StoryStatus } from '../../common/enums/story-status.enum';

@Injectable()
export class StoryService {
  constructor(
    @InjectRepository(StoryEntity)
    private readonly storyRepo: Repository<StoryEntity>,
    @InjectRepository(StoryVersionEntity)
    private readonly storyVersionRepo: Repository<StoryVersionEntity>,
    @InjectRepository(StorySceneEntity)
    private readonly sceneRepo: Repository<StorySceneEntity>,
    @InjectRepository(ScenePromptEntity)
    private readonly promptRepo: Repository<ScenePromptEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepo: Repository<WorkspaceMemberEntity>,
    @InjectRepository(GenerationTaskEntity)
    private readonly taskRepo: Repository<GenerationTaskEntity>,
    @InjectQueue('story_generate')
    private readonly storyQueue: Queue,
    @InjectQueue('scene_generate')
    private readonly sceneQueue: Queue
  ) {}

  private async ensureWorkspaceMember(userId: number, workspaceId: number) {
    const member = await this.memberRepo.findOne({
      where: { userId, workspaceId, isActive: true }
    });
    if (!member) throw new ForbiddenException('no workspace access');
  }

  async batchGenerate(dto: BatchGenerateStoryDto, userId: number) {
    const taskIds: number[] = [];
    const storyIds: number[] = [];

    await this.ensureWorkspaceMember(userId, dto.workspaceId);

    for (const title of dto.titles) {
      const story = await this.storyRepo.save(
        this.storyRepo.create({
          workspaceId: dto.workspaceId,
          projectId: dto.projectId,
          title
        })
      );

      const task = await this.taskRepo.save(
        this.taskRepo.create({
          workspaceId: dto.workspaceId,
          taskType: 'story',
          bizId: story.id,
          status: TaskStatus.PENDING,
          retryCount: 0,
          maxRetry: 3,
          idempotencyKey: `story:${story.id}:v1`,
          payloadJson: JSON.stringify({
            options: {
              targetLength: dto.targetLength,
              style: dto.style,
              audience: dto.audience,
              language: dto.language ?? 'zh-CN'
            }
          })
        })
      );

      await this.storyQueue.add(
        'story.generate',
        {
        taskId: task.id,
        storyId: story.id,
        workspaceId: dto.workspaceId,
        options: {
          targetLength: dto.targetLength,
          style: dto.style,
          audience: dto.audience,
          language: dto.language ?? 'zh-CN'
        }
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30000 }
        }
      );

      taskIds.push(task.id);
      storyIds.push(story.id);
    }

    return {
      batchSize: dto.titles.length,
      taskIds,
      storyIds
    };
  }

  async getStoryAggregate(storyId: number, userId: number) {
    const story = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!story) {
      throw new NotFoundException('story not found');
    }

    await this.ensureWorkspaceMember(userId, story.workspaceId);

    if (!story.currentVersionId) {
      return {
        story,
        currentVersion: null,
        scenes: []
      };
    }

    const currentVersion = await this.storyVersionRepo.findOne({
      where: { id: story.currentVersionId }
    });

    const scenes = currentVersion
      ? await this.sceneRepo.find({
          where: { storyVersionId: currentVersion.id },
          order: { sceneNo: 'ASC' }
        })
      : [];

    const sceneIds = scenes.map((s) => s.id);
    const prompts = sceneIds.length
      ? await this.promptRepo.find({ where: { sceneId: In(sceneIds) } })
      : [];

    const promptBySceneId = new Map(prompts.map((p) => [p.sceneId, p]));

    return {
      story,
      currentVersion,
      scenes: scenes.map((s) => ({
        ...s,
        prompt: promptBySceneId.get(s.id) ?? null
      }))
    };
  }

  async exportStory(storyId: number, userId: number) {
    const agg = await this.getStoryAggregate(storyId, userId);

    const storyTitle = agg.story?.title ?? '';
    const exportImages = agg.story?.status === StoryStatus.APPROVED;
    const contentMarkdown = [
      `# ${storyTitle}`,
      '',
      agg.currentVersion?.content ? `## 故事正文\n${agg.currentVersion.content}` : '## 故事正文\n(暂无)',
      '',
      '## 分镜与出图提示词',
      ...(agg.scenes ?? []).map((scene: any) => {
        const prompt = scene.prompt;
        const imageUrl = exportImages ? prompt?.imageUrl ?? null : null;
        const imageB64Json = exportImages ? prompt?.imageB64Json ?? null : null;
        const imageStatus = exportImages ? prompt?.imageStatus ?? null : null;
        const promptStatus = prompt?.status ?? null;
        return [
          `### 镜头 ${scene.sceneNo}`,
          `- 场景描述：${scene.sceneDesc}`,
          `- 角色动作：${scene.characterAction ?? ''}`,
          `- 旁白：${scene.narration ?? ''}`,
          prompt
            ? [
                `- 正向提示词：${prompt.positivePrompt}`,
                `- 反向提示词：${prompt.negativePrompt ?? ''}`,
                `- 参数JSON：${prompt.paramsJson ?? ''}`,
                `- 提示词审核状态：${promptStatus ?? 'unknown'}`,
                `- 图片生成状态：${imageStatus ?? 'unknown'}`,
                imageUrl
                  ? `- 图片URL：${imageUrl}`
                  : imageB64Json
                    ? `- 图片B64：已生成(长度:${String(imageB64Json).length})`
                    : `- 图片URL：暂无`
              ].join('\n')
            : `- 提示词：暂无`,
          ''
        ].join('\n');
      })
    ].join('\n');

    return {
      storyId,
      exportType: 'story_script_with_prompts',
      json: {
        ...agg,
        exportImages,
        imagesOmitted: !exportImages
      },
      markdown: contentMarkdown
    };
  }

  async approveStory(storyId: number, userId: number) {
    const story = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException('story not found');
    await this.ensureWorkspaceMember(userId, story.workspaceId);

    await this.storyRepo.update(storyId, { status: StoryStatus.APPROVED });
    // 先不做“version approved”的建模，简化：以 story 状态作为发布态
    return this.storyRepo.findOne({ where: { id: storyId } });
  }

  async rejectStory(storyId: number, userId: number, reason?: string) {
    const story = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException('story not found');
    await this.ensureWorkspaceMember(userId, story.workspaceId);

    await this.storyRepo.update(storyId, { status: StoryStatus.REJECTED });
    return this.storyRepo.findOne({ where: { id: storyId } });
  }

  async submitEditedStoryVersion(
    storyId: number,
    baseVersionId: number,
    dto: {
      title?: string;
      summary?: string;
      content: string;
      changeNote?: string;
    },
    userId: number
  ) {
    const story = await this.storyRepo.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException('story not found');

    await this.ensureWorkspaceMember(userId, story.workspaceId);

    const baseVersion = await this.storyVersionRepo.findOne({
      where: { id: baseVersionId, storyId }
    });
    if (!baseVersion) throw new NotFoundException('base story version not found');

    const last = await this.storyVersionRepo.findOne({
      where: { storyId },
      order: { versionNo: 'DESC' }
    });

    const nextNo = (last?.versionNo ?? baseVersion.versionNo ?? 0) + 1;

    const version = await this.storyVersionRepo.save(
      this.storyVersionRepo.create({
        storyId,
        title: dto.title ?? baseVersion.title,
        summary: dto.summary ?? baseVersion.summary ?? '',
        content: dto.content,
        style: baseVersion.style,
        audience: baseVersion.audience,
        targetLength: baseVersion.targetLength,
        versionNo: nextNo
      })
    );

    await this.storyRepo.update(storyId, {
      currentVersionId: version.id,
      status: StoryStatus.APPROVED
    });

    // 提交编辑后的 story 版本后，自动生成分镜与提示词链路
    const sceneTask = await this.taskRepo.save(
      this.taskRepo.create({
        workspaceId: story.workspaceId,
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
      { taskId: sceneTask.id, storyVersionId: version.id, workspaceId: story.workspaceId },
      {
        jobId: `scene:${sceneTask.id}:${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 }
      }
    );

    return version;
  }

  async listByWorkspace(input: {
    userId: number;
    workspaceId: number;
    pageQuery: PageQueryDto;
  }) {
    await this.ensureWorkspaceMember(input.userId, input.workspaceId);

    const [items, total] = await this.storyRepo.findAndCount({
      where: { workspaceId: input.workspaceId },
      order: { id: 'DESC' },
      skip: (input.pageQuery.page - 1) * input.pageQuery.pageSize,
      take: input.pageQuery.pageSize
    });

    return { items, total, page: input.pageQuery.page, pageSize: input.pageQuery.pageSize };
  }
}
