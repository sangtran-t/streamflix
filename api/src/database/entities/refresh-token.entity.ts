import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Persisted refresh token record. Stores a SHA-256 hash of the opaque token
 * (never the plaintext). Each token belongs to a "family" — on reuse of a
 * rotated token the entire family is revoked (theft detection per API.md).
 */
@Entity('refresh_token')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index('refresh_token_hash_idx')
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  /** All tokens in a family share the same family UUID. Rotating a token
   *  creates a new record in the same family. Reuse detection revokes all. */
  @Index('refresh_token_family_idx')
  @Column({ type: 'uuid' })
  family!: string;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
