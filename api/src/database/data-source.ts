import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { Genre } from './entities/genre.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Title } from './entities/title.entity';
import { User } from './entities/user.entity';
import { WatchProgress } from './entities/watch-progress.entity';
import { InitSchema1749340800000 } from './migrations/1749340800000-InitSchema';
import { SeedPhase11749340800001 } from './migrations/1749340800001-SeedPhase1';
import { Phase3Schema1749340800002 } from './migrations/1749340800002-Phase3Schema';
import { AddUserRole1749340800003 } from './migrations/1749340800003-AddUserRole';

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
  entities: [User, Title, Genre, Asset, WatchProgress, RefreshToken],
  migrations: [
    InitSchema1749340800000,
    SeedPhase11749340800001,
    Phase3Schema1749340800002,
    AddUserRole1749340800003,
  ],
  synchronize: false,
  logging: ['error', 'warn'],
};

export const AppDataSource = new DataSource(dataSourceOptions);
