import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { StoryStatus } from '../../../common/enums/story-status.enum';

@Entity('story')
export class StoryEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  workspaceId: number;

  @Column({ type: 'bigint' })
  projectId: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 20, default: StoryStatus.DRAFT })
  status: StoryStatus;

  @Column({ type: 'bigint', nullable: true })
  currentVersionId?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
