import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetStatus } from './asset-status.enum';
import { Title } from './title.entity';

/**
 * A playable encoding of a title. Modeled separately from Title so
 * multi-episode / multi-version support is a non-breaking future addition.
 */
@Entity('asset')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'title_id', type: 'uuid' })
  titleId!: string;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl!: string | null;

  @Index('asset_status_idx')
  @Column({ type: 'enum', enum: AssetStatus, enumName: 'asset_status_enum', default: AssetStatus.Queued })
  status!: AssetStatus;

  @Column({ name: 'status_message', type: 'text', nullable: true })
  statusMessage!: string | null;

  @Column({ name: 'hls_master_path', type: 'text', nullable: true })
  hlsMasterPath!: string | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Title, (title) => title.assets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'title_id' })
  title!: Title;
}
