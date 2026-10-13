import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint', nullable: true })
  workspaceId?: number;

  @Column({ type: 'bigint', nullable: true })
  operatorUserId?: number;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ type: 'varchar', length: 50 })
  targetType: string;

  @Column({ type: 'varchar', length: 64 })
  targetId: string;

  @Column({ type: 'text', nullable: true })
  detailJson?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  userAgent?: string;

  @CreateDateColumn()
  createdAt: Date;
}

