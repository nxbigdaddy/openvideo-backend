import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectEntity } from './entities/project.entity';
import { WorkspaceMemberEntity } from '../auth/entities/workspace-member.entity';
import { PageQueryDto } from '../../common/dto/page-query.dto';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepo: Repository<WorkspaceMemberEntity>
  ) {}

  async create(dto: CreateProjectDto, userId: number) {
    const member = await this.memberRepo.findOne({
      where: { workspaceId: dto.workspaceId, userId, isActive: true }
    });
    if (!member) throw new ForbiddenException('no workspace access');

    return this.projectRepo.save(this.projectRepo.create(dto));
  }

  async listByWorkspace(input: { userId: number; workspaceId: number; pageQuery: PageQueryDto }) {
    const member = await this.memberRepo.findOne({
      where: { workspaceId: input.workspaceId, userId: input.userId, isActive: true }
    });
    if (!member) throw new ForbiddenException('no workspace access');

    const [items, total] = await this.projectRepo.findAndCount({
      where: { workspaceId: input.workspaceId },
      order: { id: 'DESC' },
      skip: (input.pageQuery.page - 1) * input.pageQuery.pageSize,
      take: input.pageQuery.pageSize
    });

    return { items, total, page: input.pageQuery.page, pageSize: input.pageQuery.pageSize };
  }
}
