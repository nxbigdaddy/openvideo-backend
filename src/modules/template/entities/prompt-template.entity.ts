import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type TemplateType = 'STORY_GENERATION' | 'SCENE_GENERATION' | 'IMAGE_PROMPT_GENERATION';

@Entity('prompt_template')
export class PromptTemplateEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  workspaceId: number;

  @Column({ type: 'varchar', length: 50 })
  templateType: TemplateType;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

