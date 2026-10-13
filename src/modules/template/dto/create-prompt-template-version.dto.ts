import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { TemplateVersionStatus } from '../entities/prompt-template-version.entity';

export class CreatePromptTemplateVersionDto {
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsString()
  userPrompt: string;

  @IsOptional()
  @IsString()
  variablesSchemaJson?: string;

  @IsIn(['draft', 'published', 'archived'] as TemplateVersionStatus[])
  status: TemplateVersionStatus;
}

