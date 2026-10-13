import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitStoryVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsString()
  @MinLength(10)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}

