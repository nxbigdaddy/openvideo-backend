import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('workspace_provider_config')
export class WorkspaceProviderConfigEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  workspaceId: number;

  @Column({ type: 'varchar', length: 20 })
  providerType: 'text' | 'image';

  @Column({ type: 'varchar', length: 50 })
  providerName: string;

  @Column({ type: 'varchar', length: 255 })
  apiBaseUrl: string;

  @Column({ type: 'text' })
  apiKeyEncrypted: string;

  @Column({ type: 'varchar', length: 100 })
  modelName: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
