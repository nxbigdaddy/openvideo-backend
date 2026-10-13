import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usage_bill')
export class UsageBillEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  workspaceId: number;

  @Column({ type: 'bigint' })
  taskId: number;

  @Column({ type: 'varchar', length: 20 })
  providerType: 'text' | 'image';

  @Column({ type: 'varchar', length: 20 })
  usageUnit: 'token';

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  usageAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  costAmount: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'date' })
  billDate: string;

  @CreateDateColumn()
  createdAt: Date;
}

