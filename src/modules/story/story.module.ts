import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationTaskEntity } from '../job/entities/generation-task.entity';
import { StoryEntity } from './entities/story.entity';
import { StoryVersionEntity } from './entities/story-version.entity';
import { StorySceneEntity } from '../storyboard/entities/story-scene.entity';
import { ScenePromptEntity } from '../prompt/entities/scene-prompt.entity';
import { WorkspaceMemberEntity } from '../auth/entities/workspace-member.entity';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoryEntity,
      StoryVersionEntity,
      StorySceneEntity,
      ScenePromptEntity,
      GenerationTaskEntity,
      WorkspaceMemberEntity
    ]),
    BullModule.registerQueue({ name: 'story_generate' })
  ],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService]
})
export class StoryModule {}
