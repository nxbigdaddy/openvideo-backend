import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewStoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

