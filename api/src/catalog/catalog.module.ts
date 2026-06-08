import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Title } from '../database/entities/title.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([Title])],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
