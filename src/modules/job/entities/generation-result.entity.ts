import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('generation_result')
export class GenerationResultEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  taskId: number;

  @Column({ type: 'varchar', length: 50 })
  providerName: string;

  @Column({ type: 'varchar', length: 100 })
  modelName: string;

  @Column({ type: 'text', nullable: true })
  requestPayloadJson?: string;

  @Column({ type: 'text', nullable: true })
  responsePayloadJson?: string;

  @Column({ type: 'int', default: 0 })
  tokenInput: number;

  @Column({ type: 'int', default: 0 })
  tokenOutput: number;

  @Column({ type: 'int', default: 0 })
  elapsedMs: number;

  @CreateDateColumn()
  createdAt: Date;
}
