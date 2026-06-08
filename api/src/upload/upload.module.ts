import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Asset } from '../database/entities/asset.entity';
import { Title } from '../database/entities/title.entity';
import { StatusSubscriberService } from './status-subscriber.service';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, Title])],
  controllers: [UploadController],
  providers: [UploadService, StatusSubscriberService],
})
export class UploadModule {}
