import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>
  ) {}

  async record(input: {
    workspaceId?: number;
    operatorUserId?: number;
    action: string;
    targetType: string;
    targetId: string;
    detail?: unknown;
    ip?: string;
    userAgent?: string;
  }) {
    const entity = this.auditRepo.create({
      workspaceId: input.workspaceId,
      operatorUserId: input.operatorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      detailJson: input.detail ? JSON.stringify(input.detail) : undefined,
      ip: input.ip,
      userAgent: input.userAgent
    });
    return this.auditRepo.save(entity);
  }

  async listByWorkspace(input: { workspaceId: number; page: number; pageSize: number }) {
    const [items, total] = await this.auditRepo.findAndCount({
      where: { workspaceId: input.workspaceId },
      order: { id: 'DESC' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize
    });
    return { items, total, page: input.page, pageSize: input.pageSize };
  }
}

