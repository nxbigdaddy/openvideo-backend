import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class BatchGenerateStoryDto {
  @IsInt()
  workspaceId: number;

  @IsInt()
  projectId: number;

  @IsArray()
  titles: string[];

  @IsInt()
  @Min(100)
  @Max(5000)
  targetLength: number;

  @IsString()
  style: string;

  @IsString()
  audience: string;

  @IsOptional()
  @IsString()
  language?: string = 'zh-CN';
}
