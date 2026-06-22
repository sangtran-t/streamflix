import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Asset } from '../database/entities/asset.entity';
import { AssetStatus } from '../database/entities/asset-status.enum';
import { Title } from '../database/entities/title.entity';
import { StorageService } from '../storage/storage.service';
import { TemporalService } from '../temporal/temporal.service';
import { CreateUploadDto } from './dto/create-upload.dto';

export interface InitUploadResponse {
  assetId: string;
  putUrl: string;
  expiresAt: string;
}

export interface UploadStatusResponse {
  status: AssetStatus;
  progress: number | null;
}

/** Schema version for the job message (per COMMUNICATION.md §2) */
const JOB_SCHEMA_VERSION = '1.0';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @InjectRepository(Title)
    private readonly titles: Repository<Title>,
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    private readonly storage: StorageService,
    private readonly temporal: TemporalService,
  ) {}

  async initUpload(dto: CreateUploadDto): Promise<InitUploadResponse> {
    const ext = this.extractExtension(dto.filename);
    const assetId = uuidv4();
    const inputKey = this.storage.rawKey(assetId, ext);

    const slug = this.slugify(dto.name) + '-' + assetId.slice(0, 8);
    const title = this.titles.create({
      slug,
      name: dto.name,
      synopsis: dto.synopsis,
      year: dto.year,
    });
    const savedTitle = await this.titles.save(title);

    const asset = this.assets.create({
      id: assetId,
      titleId: savedTitle.id,
      sourceUrl: inputKey,
      status: AssetStatus.Queued,
    });
    await this.assets.save(asset);

    const { url, expiresAt } = await this.storage.getPresignedPutUrl(
      inputKey,
      dto.contentType,
      900,
    );

    this.logger.log(`Upload initiated assetId=${assetId} key=${inputKey}`);
    return { assetId, putUrl: url, expiresAt };
  }

  async completeUpload(assetId: string): Promise<void> {
    const asset = await this.findAssetOrThrow(assetId);

    if (!asset.sourceUrl) {
      throw new BadRequestException('Asset has no source URL — cannot complete');
    }
    if (asset.status !== AssetStatus.Queued) {
      throw new BadRequestException(
        `Asset is already in status "${asset.status}"; cannot re-enqueue`,
      );
    }

    try {
      await this.storage.headObject(asset.sourceUrl);
    } catch {
      throw new BadRequestException(
        `Source file not found in storage (key=${asset.sourceUrl}). ` +
          'Upload the file before calling /complete.',
      );
    }

    const correlationId = uuidv4();
    const jobId = uuidv4();
    const workflowId = await this.temporal.startTranscodeWorkflow({
      schemaVersion: JOB_SCHEMA_VERSION,
      jobId,
      assetId: asset.id,
      correlationId,
      inputKey: asset.sourceUrl,
      title: asset.title?.name ?? '',
      requestedAt: new Date().toISOString(),
    });

    this.logger.log(
      `TranscodeWorkflow started assetId=${assetId} jobId=${jobId} workflowId=${workflowId} correlationId=${correlationId}`,
    );
  }

  async getStatus(assetId: string): Promise<UploadStatusResponse> {
    const asset = await this.findAssetOrThrow(assetId);
    return { status: asset.status, progress: null };
  }

  private async findAssetOrThrow(assetId: string): Promise<Asset> {
    const asset = await this.assets.findOne({
      where: { id: assetId },
      relations: ['title'],
    });
    if (!asset) throw new NotFoundException(`Asset ${assetId} not found`);
    return asset;
  }

  private extractExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length < 2) return 'mp4';
    return parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
}
