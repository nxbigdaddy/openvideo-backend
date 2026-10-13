import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmProviderService } from './adapters/llm-provider.service';
import { WorkspaceProviderConfigEntity } from '../workspace/entities/workspace-provider-config.entity';
import { ProviderConfigService } from './provider-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceProviderConfigEntity])],
  providers: [LlmProviderService, ProviderConfigService],
  exports: [LlmProviderService, ProviderConfigService]
})
export class ProviderModule {}
