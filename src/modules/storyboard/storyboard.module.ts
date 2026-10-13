import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorySceneEntity } from './entities/story-scene.entity';
import { StoryboardController } from './storyboard.controller';
import { StoryboardService } from './storyboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([StorySceneEntity])],
  controllers: [StoryboardController],
  providers: [StoryboardService]
})
export class StoryboardModule {}
