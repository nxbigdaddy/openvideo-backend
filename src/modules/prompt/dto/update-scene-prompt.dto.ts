import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateScenePromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(200000)
  positivePrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  negativePrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  paramsJson?: string;

  @IsOptional()
  @IsIn(['generated', 'edited', 'approved', 'rejected'] as const)
  status?: 'generated' | 'edited' | 'approved' | 'rejected';
}

