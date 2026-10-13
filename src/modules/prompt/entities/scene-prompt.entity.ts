import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('scene_prompt')
export class ScenePromptEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  sceneId: number;

  @Column({ type: 'int', default: 1 })
  promptVersion: number;

  @Column({ type: 'text' })
  positivePrompt: string;

  @Column({ type: 'text', nullable: true })
  negativePrompt?: string;

  @Column({ type: 'text', nullable: true })
  paramsJson?: string;

  @Column({ type: 'varchar', length: 20, default: 'generated' })
  status: 'generated' | 'edited' | 'approved' | 'rejected';

  @Column({ type: 'varchar', length: 20, nullable: true })
  imageStatus?: 'none' | 'generated' | 'failed';

  @Column({ type: 'text', nullable: true })
  imageUrl?: string;

  @Column({ type: 'text', nullable: true })
  imageB64Json?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  imageProviderName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  imageModelName?: string;

  @Column({ type: 'bigint', nullable: true })
  imageTaskId?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
