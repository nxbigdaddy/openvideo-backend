import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceEntity } from './entities/workspace.entity';
import { WorkspaceProviderConfigEntity } from './entities/workspace-provider-config.entity';
import { CreateWorkspaceProviderConfigDto } from './dto/create-workspace-provider-config.dto';
import { WorkspaceMemberEntity } from '../auth/entities/workspace-member.entity';
import { encryptToBase64 } from '../../common/crypto/encryption';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceProviderConfigEntity)
    private readonly providerConfigRepo: Repository<WorkspaceProviderConfigEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepo: Repository<WorkspaceMemberEntity>
  ) {}

  async create(dto: CreateWorkspaceDto, ownerUserId: number) {
    const entity = this.workspaceRepo.create({ name: dto.name });
    const saved = await this.workspaceRepo.save(entity);

    await this.memberRepo.save(
      this.memberRepo.create({
        workspaceId: saved.id,
        userId: ownerUserId,
        role: 'owner',
        isActive: true
      })
    );

    return saved;
  }

  async createProviderConfig(dto: CreateWorkspaceProviderConfigDto & { operatorUserId: number }) {
    const member = await this.memberRepo.findOne({
      where: { workspaceId: dto.workspaceId, userId: dto.operatorUserId, isActive: true }
    });
    if (!member) throw new ForbiddenException('no workspace access');

    const entity = this.providerConfigRepo.create({
      workspaceId: dto.workspaceId,
      providerType: dto.providerType,
      providerName: dto.providerName,
      apiBaseUrl: dto.apiBaseUrl.replace(/\/+$/, ''),
      apiKeyEncrypted: encryptToBase64(dto.apiKey),
      modelName: dto.modelName,
      isDefault: dto.isDefault ?? false
    });

    if (entity.isDefault) {
      await this.providerConfigRepo.update(
        { workspaceId: dto.workspaceId, providerType: dto.providerType, isDefault: true },
        { isDefault: false }
      );
    }

    return this.providerConfigRepo.save(entity);
  }

  async listProviderConfigs(input: {
    operatorUserId: number;
    workspaceId: number;
    providerType?: 'text' | 'image';
  }) {
    const member = await this.memberRepo.findOne({
      where: { workspaceId: input.workspaceId, userId: input.operatorUserId, isActive: true }
    });
    if (!member) throw new ForbiddenException('no workspace access');

    const where: any = { workspaceId: input.workspaceId };
    if (input.providerType) where.providerType = input.providerType;

    const rows = await this.providerConfigRepo.find({ where, order: { updatedAt: 'DESC' } });

    // 列表接口返回掩码后的密钥，避免前端拿到明文
    return rows.map((r) => ({
      ...r,
      apiKeyEncrypted: r.apiKeyEncrypted ? `****${String(r.apiKeyEncrypted).slice(-4)}` : r.apiKeyEncrypted
    }));
  }
}
