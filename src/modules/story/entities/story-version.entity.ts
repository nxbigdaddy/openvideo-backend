import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('story_version')
export class StoryVersionEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  storyId: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 50 })
  style: string;

  @Column({ type: 'varchar', length: 50 })
  audience: string;

  @Column({ type: 'int' })
  targetLength: number;

  @Column({ type: 'int', default: 1 })
  versionNo: number;

  @CreateDateColumn()
  createdAt: Date;
}
