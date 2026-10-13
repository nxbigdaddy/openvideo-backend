import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceProviderConfigEntity } from '../workspace/entities/workspace-provider-config.entity';
import { decryptFromBase64 } from '../../common/crypto/encryption';

export type ProviderRuntimeConfig = {
  apiBaseUrl: string;
  apiKey: YOUR_SECRET;
  providerName: string;
  modelName: string;
};

@Injectable()
export class ProviderConfigService {
  constructor(
    @InjectRepository(WorkspaceProviderConfigEntity)
    private readonly configRepo: Repository<WorkspaceProviderConfigEntity>
  ) {}

  async getTextProviderConfig(workspaceId: number): Promise<ProviderRuntimeConfig | null> {
    const configs = await this.configRepo.find({
      where: { workspaceId, providerType: 'text' },
      order: { updatedAt: 'DESC' }
    });

    if (!configs.length) return null;
    const picked = configs.find((c) => c.isDefault) ?? configs[0];
    return {
      apiBaseUrl: picked.apiBaseUrl.replace(/\/+$/, ''),
      apiKey: YOUR_SECRET),
      providerName: picked.providerName,
      modelName: picked.modelName
    };
  }

  async getImageProviderConfig(workspaceId: number): Promise<ProviderRuntimeConfig | null> {
    const configs = await this.configRepo.find({
      where: { workspaceId, providerType: 'image' },
      order: { updatedAt: 'DESC' }
    });

    if (!configs.length) return null;
    const picked = configs.find((c) => c.isDefault) ?? configs[0];
    return {
      apiBaseUrl: picked.apiBaseUrl.replace(/\/+$/, ''),
      apiKey: YOUR_SECRET),
      providerName: picked.providerName,
      modelName: picked.modelName
    };
  }
}

