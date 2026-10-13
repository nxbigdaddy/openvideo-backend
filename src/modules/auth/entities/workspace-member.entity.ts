import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

@Entity('workspace_member')
export class WorkspaceMemberEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  workspaceId: number;

  @Column({ type: 'bigint' })
  userId: number;

  @Column({ type: 'varchar', length: 20 })
  role: WorkspaceRole;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

