import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { Genre } from './entities/genre.entity';
import { Title } from './entities/title.entity';
import { User } from './entities/user.entity';
import { WatchProgress } from './entities/watch-progress.entity';
import { InitSchema1749340800000 } from './migrations/1749340800000-InitSchema';

// When invoked via the TypeORM CLI, dotenv is not loaded by NestJS yet.
// SetDefault skips variables already present in the environment.
loadEnv({ path: resolve(process.cwd(), '../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy infra/.env.example to .env at the repo root and retry.',
  );
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Title, Genre, Asset, WatchProgress],
  migrations: [InitSchema1749340800000],
  synchronize: false,
  logging: ['error', 'warn'],
};

export const AppDataSource = new DataSource(dataSourceOptions);
