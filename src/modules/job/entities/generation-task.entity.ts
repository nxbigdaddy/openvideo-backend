import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TaskStatus } from '../../../common/enums/task-status.enum';

@Entity('generation_task')
export class GenerationTaskEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  workspaceId: number;

  @Column({ type: 'varchar', length: 30 })
  taskType: 'story' | 'scene' | 'prompt' | 'image';

  @Column({ type: 'bigint' })
  bizId: number;

  @Column({ type: 'varchar', length: 20, default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetry: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  idempotencyKey?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  errorCode?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true })
  payloadJson?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
