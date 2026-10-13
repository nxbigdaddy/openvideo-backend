import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TemplateType } from './prompt-template.entity';

export type TemplateVersionStatus = 'draft' | 'published' | 'archived';

@Entity('prompt_template_version')
export class PromptTemplateVersionEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  templateId: number;

  @Column({ type: 'int', default: 1 })
  versionNo: number;

  @Column({ type: 'text', nullable: true })
  systemPrompt?: string;

  @Column({ type: 'text' })
  userPrompt: string;

  @Column({ type: 'text', nullable: true })
  variablesSchemaJson?: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: TemplateVersionStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  renderedByType?: TemplateType | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

