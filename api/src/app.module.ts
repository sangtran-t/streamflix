import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { ProgressModule } from './progress/progress.module';
import { CorrelationMiddleware } from './common/logging/correlation.middleware';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { PlaybackModule } from './playback/playback.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    StorageModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    PlaybackModule,
    UploadModule,
    ProgressModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
