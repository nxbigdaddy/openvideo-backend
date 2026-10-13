import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { TemplateType } from '../entities/prompt-template.entity';

export class CreatePromptTemplateDto {
  @IsInt()
  workspaceId: number;

  @IsIn(['STORY_GENERATION', 'SCENE_GENERATION', 'IMAGE_PROMPT_GENERATION'] as TemplateType[])
  templateType: TemplateType;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

