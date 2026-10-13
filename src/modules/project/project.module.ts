import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from './entities/project.entity';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { WorkspaceMemberEntity } from '../auth/entities/workspace-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, WorkspaceMemberEntity])],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService]
})
export class ProjectModule {}
