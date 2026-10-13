import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptTemplateEntity } from './entities/prompt-template.entity';
import { PromptTemplateVersionEntity } from './entities/prompt-template-version.entity';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromptTemplateEntity, PromptTemplateVersionEntity]),
    AuthModule,
    AuditModule
  ],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService]
})
export class TemplateModule {}

