import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WatchProgress } from './watch-progress.entity';

export type UserRole = 'user' | 'admin';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Physical column is CITEXT for case-insensitive login; mapped as text
  // because TypeORM has no citext column type.
  @Index('user_email_key', { unique: true })
  @Column({ type: 'text' })
  email!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  /** Access level. All newly registered users default to 'user'.
   *  Promote to 'admin' with: UPDATE "user" SET role = 'admin' WHERE email = '...'; */
  @Column({ type: 'text', default: 'user' })
  role!: UserRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => WatchProgress, (progress) => progress.user)
  progress!: WatchProgress[];
}
