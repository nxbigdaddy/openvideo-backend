import { Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JobService } from './job.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspacePermissionService } from '../auth/workspace-permission.service';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { TaskStatus } from '../../common/enums/task-status.enum';

@Controller('tasks')
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly permissionService: WorkspacePermissionService
  ) {}

  @Get(':taskId')
  @UseGuards(JwtAuthGuard)
  async getTask(@Param('taskId', ParseIntPipe) taskId: number) {
    const task = await this.jobService.getTask(taskId);
    return task;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Query('workspaceId') workspaceId: number,
    @Query('status') status: TaskStatus,
    @Query() pageQuery: PageQueryDto,
    @Req() req: any
  ) {
    // 先用任务列表的 workspaceId 做权限校验
    await this.permissionService.ensureMember(req.user.userId, Number(workspaceId));
    return this.jobService.listByWorkspace({
      workspaceId: Number(workspaceId),
      status,
      pageQuery
    });
  }

  @Post(':taskId/rerun')
  @UseGuards(JwtAuthGuard)
  async rerun(@Param('taskId', ParseIntPipe) taskId: number, @Req() req: any) {
    const task = await this.jobService.getTask(taskId);
    await this.permissionService.ensureMember(req.user.userId, task.workspaceId);
    await this.jobService.rerunTask(taskId);
    return { taskId, status: 'queued' };
  }
}
