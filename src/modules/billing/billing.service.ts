import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageBillEntity } from './entities/usage-bill.entity';
import { GenerationResultEntity } from '../job/entities/generation-result.entity';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(UsageBillEntity)
    private readonly billRepo: Repository<UsageBillEntity>
  ) {}

  async recordFromResult(input: {
    workspaceId: number;
    taskId: number;
    providerType: 'text' | 'image';
    result: GenerationResultEntity;
  }) {
    // MVP：没有Provider价格表时先按0成本占位；保留usageAmount用于后续接入计价。
    // usageAmount = tokenInput + tokenOutput
    const usageAmount = (input.result.tokenInput ?? 0) + (input.result.tokenOutput ?? 0);

    const today = new Date().toISOString().slice(0, 10);
    const entity = this.billRepo.create({
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      providerType: input.providerType,
      usageUnit: 'token',
      usageAmount,
      costAmount: 0,
      currency: 'USD',
      billDate: today
    });
    return this.billRepo.save(entity);
  }

  async listByWorkspace(input: { workspaceId: number; page: number; pageSize: number }) {
    const [items, total] = await this.billRepo.findAndCount({
      where: { workspaceId: input.workspaceId },
      order: { id: 'DESC' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize
    });
    return { items, total, page: input.page, pageSize: input.pageSize };
  }

  async summaryByWorkspace(input: { workspaceId: number }) {
    const rows = await this.billRepo
      .createQueryBuilder('b')
      .select('b.providerType', 'providerType')
      .addSelect('SUM(b.usageAmount)', 'usageAmount')
      .addSelect('SUM(b.costAmount)', 'costAmount')
      .addSelect('MAX(b.billDate)', 'billDate')
      .where('b.workspaceId = :workspaceId', { workspaceId: input.workspaceId })
      .groupBy('b.providerType')
      .getRawMany<{ providerType: string; usageAmount: string; costAmount: string; billDate: string }>();

    return rows.map((r) => ({
      providerType: r.providerType,
      usageAmount: Number(r.usageAmount ?? 0),
      costAmount: Number(r.costAmount ?? 0),
      billDate: r.billDate
    }));
  }
}

