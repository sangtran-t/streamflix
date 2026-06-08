import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Asset } from './asset.entity';
import { Genre } from './genre.entity';
import { WatchProgress } from './watch-progress.entity';

@Entity('title')
export class Title {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('title_slug_key', { unique: true })
  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  synopsis!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ name: 'runtime_seconds', type: 'int', nullable: true })
  runtimeSeconds!: number | null;

  @Column({ name: 'hero_image_url', type: 'text', nullable: true })
  heroImageUrl!: string | null;

  @Column({ name: 'poster_image_url', type: 'text', nullable: true })
  posterImageUrl!: string | null;

  @Index('title_popularity_idx')
  @Column({ type: 'int', default: 0 })
  popularity!: number;

  // search_vector (tsvector) is maintained by the migration and not mapped as
  // an ORM column — queries against it use the query builder / raw SQL.

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToMany(() => Genre, (genre) => genre.titles)
  @JoinTable({
    name: 'title_genre',
    joinColumn: { name: 'title_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres!: Genre[];

  @OneToMany(() => Asset, (asset) => asset.title)
  assets!: Asset[];

  @OneToMany(() => WatchProgress, (progress) => progress.title)
  progress!: WatchProgress[];
}
