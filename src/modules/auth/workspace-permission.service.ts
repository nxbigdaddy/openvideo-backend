import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMemberEntity, WorkspaceRole } from './entities/workspace-member.entity';

@Injectable()
export class WorkspacePermissionService {
  constructor(
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepo: Repository<WorkspaceMemberEntity>
  ) {}

  async getRole(userId: number, workspaceId: number): Promise<WorkspaceRole | null> {
    const row = await this.memberRepo.findOne({
      where: { userId, workspaceId, isActive: true },
      order: { id: 'DESC' }
    });
    return row?.role ?? null;
  }

  async ensureMember(userId: number, workspaceId: number) {
    const role = await this.getRole(userId, workspaceId);
    if (!role) throw new ForbiddenException('no workspace access');
    return role;
  }
}

