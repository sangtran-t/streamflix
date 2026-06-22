import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Asset } from '../database/entities/asset.entity';
import { AuthModule } from '../auth/auth.module';
import { PlaybackController } from './playback.controller';
import { PlaybackService } from './playback.service';
import { SIGNING_SECRET, SigningService } from './signing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Asset]), AuthModule],
  controllers: [PlaybackController],
  providers: [
    {
      provide: SIGNING_SECRET,
      useFactory: (): string => process.env['SIGNING_SECRET'] ?? 'dev-signing-secret-change-me',
    },
    SigningService,
    PlaybackService,
  ],
})
export class PlaybackModule {}
