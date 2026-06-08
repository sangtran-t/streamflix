import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Title } from './title.entity';
import { User } from './user.entity';

@Entity('watch_progress')
@Index('watch_progress_user_id_updated_at_idx', ['userId', 'updatedAt'])
export class WatchProgress {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'title_id', type: 'uuid' })
  titleId!: string;

  @Column({ name: 'position_seconds', type: 'int', default: 0 })
  positionSeconds!: number;

  @Column({ type: 'boolean', default: false })
  completed!: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.progress, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Title, (title) => title.progress, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'title_id' })
  title!: Title;
}
