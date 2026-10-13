import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('story_scene')
export class StorySceneEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  storyVersionId: number;

  @Column({ type: 'int' })
  sceneNo: number;

  @Column({ type: 'text' })
  sceneDesc: string;

  @Column({ type: 'text', nullable: true })
  characterAction?: string;

  @Column({ type: 'text', nullable: true })
  narration?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
