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
import {
  InitUploadResponse,
  UploadService,
  UploadStatusResponse,
} from './upload.service';

@Controller({ version: '1', path: 'uploads' })
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly upload: UploadService) {}

  /**
   * POST /uploads
   *
   * Creates a Title + Asset row (status=queued) and returns a pre-signed PUT
   * URL the client uses to upload the raw file directly to MinIO (ADR-0008).
   * The client must call /uploads/:assetId/complete once the PUT succeeds.
   */
  @Post()
  async initUpload(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateUploadDto,
  ): Promise<InitUploadResponse> {
    return this.upload.initUpload(dto);
  }

  /**
   * POST /uploads/:assetId/complete
   *
   * Verifies the source object is present in storage, then enqueues a
   * transcode job via Redis Streams. Returns 202 — work is asynchronous.
   * Poll GET /uploads/:assetId/status to track progress.
   */
  @Post(':assetId/complete')
  @HttpCode(202)
  async completeUpload(@Param('assetId') assetId: string): Promise<void> {
    await this.upload.completeUpload(assetId);
  }

  /**
   * GET /uploads/:assetId/status
   *
   * Returns the current processing status of the asset.
   * Clients should poll this at ~2s intervals until status is "ready" or "failed".
   */
  @Get(':assetId/status')
  async getStatus(@Param('assetId') assetId: string): Promise<UploadStatusResponse> {
    return this.upload.getStatus(assetId);
  }
}
