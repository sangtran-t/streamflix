import { Column, Entity, Index, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Title } from './title.entity';

@Entity('genre')
export class Genre {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('genre_name_key', { unique: true })
  @Column({ type: 'text' })
  name!: string;

  @ManyToMany(() => Title, (title) => title.genres)
  titles!: Title[];
}
