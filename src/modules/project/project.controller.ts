import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PageQueryDto } from '../../common/dto/page-query.dto';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateProjectDto, @Req() req: any) {
    return this.projectService.create(dto, req.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Query('workspaceId') workspaceId: number,
    @Query() pageQuery: PageQueryDto,
    @Req() req: any
  ) {
    return this.projectService.listByWorkspace({
      userId: req.user.userId,
      workspaceId: Number(workspaceId),
      pageQuery
    });
  }
}
