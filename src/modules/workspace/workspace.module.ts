import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceEntity } from './entities/workspace.entity';
import { WorkspaceProviderConfigEntity } from './entities/workspace-provider-config.entity';
import { WorkspaceMemberEntity } from '../auth/entities/workspace-member.entity';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceEntity, WorkspaceProviderConfigEntity, WorkspaceMemberEntity])],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService]
})
export class WorkspaceModule {}
