import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { GenerationTaskEntity } from './entities/generation-task.entity';
import { GenerationResultEntity } from './entities/generation-result.entity';
import { Queue } from 'bullmq';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { PageQueryDto } from '../../common/dto/page-query.dto';

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(GenerationTaskEntity)
    private readonly taskRepo: Repository<GenerationTaskEntity>,
    @InjectRepository(GenerationResultEntity)
    private readonly resultRepo: Repository<GenerationResultEntity>,
    @InjectQueue('story_generate')
    private readonly storyQueue: Queue,
    @InjectQueue('scene_generate')
    private readonly sceneQueue: Queue,
    @InjectQueue('prompt_generate')
    private readonly promptQueue: Queue,
    @InjectQueue('image_generate')
    private readonly imageQueue: Queue
  ) {}

  async getTask(taskId: number) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('task not found');
    }
    const result = await this.resultRepo.findOne({
      where: { taskId },
      order: { id: 'DESC' }
    });

    let responseJson: unknown = null;
    if (result?.responsePayloadJson) {
      try {
        responseJson = JSON.parse(result.responsePayloadJson);
      } catch {
        responseJson = null;
      }
    }

    return {
      ...task,
      result: result
        ? {
            ...result,
            responseJson
          }
        : null
    };
  }

  private parsePayloadJson(payloadJson?: string): any {
    if (!payloadJson) return {};
    try {
      return JSON.parse(payloadJson);
    } catch {
      return {};
    }
  }

  async rerunTask(taskId: number) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('task not found');

    // 重跑前重置错误信息与状态
    await this.taskRepo.update(taskId, {
      status: TaskStatus.PENDING,
      errorCode: undefined,
      errorMessage: undefined,
      retryCount: 0
    });

    const payload = this.parsePayloadJson(task.payloadJson);

    const jobId = `rerun:${taskId}:${Date.now()}`;

    if (task.taskType === 'story') {
      await this.storyQueue.add(
        'story.generate',
        {
          taskId,
          storyId: task.bizId,
          workspaceId: task.workspaceId,
          options: payload.options ?? {}
        },
        { jobId, attempts: 3, backoff: { type: 'exponential', delay: 30000 } }
      );
      return;
    }

    if (task.taskType === 'scene') {
      await this.sceneQueue.add(
        'scene.generate',
        { taskId, storyVersionId: task.bizId, workspaceId: task.workspaceId },
        { jobId, attempts: 3, backoff: { type: 'exponential', delay: 30000 } }
      );
      return;
    }

    if (task.taskType === 'prompt') {
      await this.promptQueue.add(
        'prompt.generate',
        { taskId, sceneId: task.bizId, workspaceId: task.workspaceId },
        { jobId, attempts: 3, backoff: { type: 'exponential', delay: 30000 } }
      );
      return;
    }

    if (task.taskType === 'image') {
      await this.imageQueue.add(
        'image.generate',
        { taskId, scenePromptId: task.bizId, workspaceId: task.workspaceId },
        { jobId, attempts: 3, backoff: { type: 'exponential', delay: 30000 } }
      );
      return;
    }

    throw new NotFoundException('unknown taskType');
  }

  async listByWorkspace(input: {
    workspaceId: number;
    status?: TaskStatus;
    pageQuery: PageQueryDto;
  }) {
    const where: any = { workspaceId: input.workspaceId };
    if (input.status) where.status = input.status;

    const [items, total] = await this.taskRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (input.pageQuery.page - 1) * input.pageQuery.pageSize,
      take: input.pageQuery.pageSize
    });

    return { items, total, page: input.pageQuery.page, pageSize: input.pageQuery.pageSize };
  }
}
