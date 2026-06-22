import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUploadDto } from './dto/create-upload.dto';
import { InitUploadResponse, UploadService, UploadStatusResponse } from './upload.service';

@Controller({ version: '1', path: 'uploads' })
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly upload: UploadService) {}

  @Post()
  async initUpload(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateUploadDto,
  ): Promise<InitUploadResponse> {
    return this.upload.initUpload(dto);
  }

  // Returns 202 — work is asynchronous; poll /status to track progress.
  @Post(':assetId/complete')
  @HttpCode(202)
  async completeUpload(@Param('assetId') assetId: string): Promise<void> {
    await this.upload.completeUpload(assetId);
  }

  @Get(':assetId/status')
  async getStatus(@Param('assetId') assetId: string): Promise<UploadStatusResponse> {
    return this.upload.getStatus(assetId);
  }
}
