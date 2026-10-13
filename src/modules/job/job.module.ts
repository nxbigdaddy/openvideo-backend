import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerationTaskEntity } from './entities/generation-task.entity';
import { GenerationResultEntity } from './entities/generation-result.entity';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { PromptProcessor } from './processors/prompt.processor';
import { SceneProcessor } from './processors/scene.processor';
import { StoryProcessor } from './processors/story.processor';
import { ImageProcessor } from './processors/image.processor';
import { StoryEntity } from '../story/entities/story.entity';
import { StoryVersionEntity } from '../story/entities/story-version.entity';
import { StorySceneEntity } from '../storyboard/entities/story-scene.entity';
import { ScenePromptEntity } from '../prompt/entities/scene-prompt.entity';
import { ProviderModule } from '../provider/provider.module';
import { TemplateModule } from '../template/template.module';
import { BillingModule } from '../billing/billing.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GenerationTaskEntity,
      GenerationResultEntity,
      StoryEntity,
      StoryVersionEntity,
      StorySceneEntity,
      ScenePromptEntity
    ]),
    ProviderModule,
    TemplateModule,
    BillingModule,
    AuditModule,
    AuthModule,
    BullModule.registerQueue(
      { name: 'story_generate' },
      { name: 'scene_generate' },
      { name: 'prompt_generate' },
      { name: 'image_generate' }
    )
  ],
  controllers: [JobController],
  providers: [JobService, StoryProcessor, SceneProcessor, PromptProcessor, ImageProcessor],
  exports: [JobService]
})
export class JobModule {}
