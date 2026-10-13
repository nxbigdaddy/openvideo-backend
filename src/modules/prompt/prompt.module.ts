import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScenePromptEntity } from './entities/scene-prompt.entity';
import { PromptController } from './prompt.controller';
import { PromptService } from './prompt.service';
import { StorySceneEntity } from '../storyboard/entities/story-scene.entity';
import { StoryVersionEntity } from '../story/entities/story-version.entity';
import { StoryEntity } from '../story/entities/story.entity';
import { WorkspaceMemberEntity } from '../auth/entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScenePromptEntity,
      StorySceneEntity,
      StoryVersionEntity,
      StoryEntity,
      WorkspaceMemberEntity
    ]),
    AuditModule
  ],
  controllers: [PromptController],
  providers: [PromptService]
})
export class PromptModule {}
