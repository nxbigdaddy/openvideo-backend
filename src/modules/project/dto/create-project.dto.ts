import { IsIn, IsInt, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsInt()
  workspaceId: number;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsIn(['single', 'batch', 'import'])
  sourceType: 'single' | 'batch' | 'import';
}
