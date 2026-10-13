import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { getTypeOrmOptions } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ProjectModule } from './modules/project/project.module';
import { StoryModule } from './modules/story/story.module';
import { StoryboardModule } from './modules/storyboard/storyboard.module';
import { PromptModule } from './modules/prompt/prompt.module';
import { JobModule } from './modules/job/job.module';
import { ProviderModule } from './modules/provider/provider.module';
import { TemplateModule } from './modules/template/template.module';
import { BillingModule } from './modules/billing/billing.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRoot(getTypeOrmOptions()),
    BullModule.forRoot({
      connection: redisConfig
    }),
    WorkspaceModule,
    ProjectModule,
    StoryModule,
    StoryboardModule,
    PromptModule,
    ProviderModule,
    TemplateModule,
    BillingModule,
    AuditModule,
    AuthModule,
    JobModule
  ]
})
export class AppModule {}
