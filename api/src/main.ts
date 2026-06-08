import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { StructuredLogger } from './common/logging/structured-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(new StructuredLogger());

  // Cookie parser — required for reading httpOnly refresh-token cookie.
  app.use(cookieParser());

  // URI versioning: /v1/auth/..., /v1/catalog/..., /v1/playback/...
  // Operational endpoints (healthz, readyz) are marked VERSION_NEUTRAL
  // and remain unversioned.
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
