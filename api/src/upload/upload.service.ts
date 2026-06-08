import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Asset } from '../database/entities/asset.entity';
import { AssetStatus } from '../database/entities/asset-status.enum';
import { Title } from '../database/entities/title.entity';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { CreateUploadDto } from './dto/create-upload.dto';

/** Shape returned by POST /uploads */
export interface InitUploadResponse {
  assetId: string;
  /** Pre-signed PUT URL — client sends raw bytes directly to MinIO/S3. */
  putUrl: string;
  expiresAt: string;
}

/** Shape returned by GET /uploads/:assetId/status */
export interface UploadStatusResponse {
  status: AssetStatus;
  /** 0–1 best-effort progress. Only meaningful during "processing". */
  progress: number | null;
}

/** Redis Streams name (per COMMUNICATION.md §1) */
const TRANSCODE_STREAM = 'transcode:jobs';
/** Consumer group name (per COMMUNICATION.md §1) */
const CONSUMER_GROUP = 'transcoders';
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
    private readonly redis: RedisService,
  ) {}

  // ── POST /uploads ───────────────────────────────────────────────────────────

  /**
   * Create a Title + Asset row and return a pre-signed PUT URL so the client
   * can upload the raw file directly to MinIO (ADR-0008).
   */
  async initUpload(dto: CreateUploadDto): Promise<InitUploadResponse> {
    const ext = this.extractExtension(dto.filename);
    const assetId = uuidv4();
    const inputKey = this.storage.rawKey(assetId, ext);

    // 1. Persist the Title (slug derived from name + assetId suffix for uniqueness)
    const slug = this.slugify(dto.name) + '-' + assetId.slice(0, 8);
    const title = this.titles.create({
      slug,
      name: dto.name,
      synopsis: dto.synopsis,
      year: dto.year,
    });
    const savedTitle = await this.titles.save(title);

    // 2. Persist the Asset (status=queued, sourceUrl = storage key)
    const asset = this.assets.create({
      id: assetId,
      titleId: savedTitle.id,
      sourceUrl: inputKey,
      status: AssetStatus.Queued,
    });
    await this.assets.save(asset);

    // 3. Issue pre-signed PUT URL (15 min TTL)
    const { url, expiresAt } = await this.storage.getPresignedPutUrl(
      inputKey,
      dto.contentType,
      900,
    );

    this.logger.log(`Upload initiated assetId=${assetId} key=${inputKey}`);
    return { assetId, putUrl: url, expiresAt };
  }

  // ── POST /uploads/:assetId/complete ─────────────────────────────────────────

  /**
   * Verify the object landed in storage, then enqueue the transcode job.
   * Returns 202 — processing is asynchronous.
   */
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

    // Verify the object is actually in storage (HEAD check)
    try {
      await this.storage.headObject(asset.sourceUrl);
    } catch {
      throw new BadRequestException(
        `Source file not found in storage (key=${asset.sourceUrl}). ` +
          'Upload the file before calling /complete.',
      );
    }

    // Ensure the consumer group exists (idempotent)
    await this.redis.ensureConsumerGroup(TRANSCODE_STREAM, CONSUMER_GROUP);

    // Build the job message per COMMUNICATION.md §2
    const correlationId = uuidv4();
    const jobId = uuidv4();
    await this.redis.xadd(TRANSCODE_STREAM, {
      schemaVersion: JOB_SCHEMA_VERSION,
      jobId,
      assetId: asset.id,
      correlationId,
      inputKey: asset.sourceUrl,
      title: asset.title?.name ?? '',
      requestedAt: new Date().toISOString(),
    });

    this.logger.log(
      `Transcode job enqueued assetId=${assetId} jobId=${jobId} correlationId=${correlationId}`,
    );
  }

  // ── GET /uploads/:assetId/status ────────────────────────────────────────────

  async getStatus(assetId: string): Promise<UploadStatusResponse> {
    const asset = await this.findAssetOrThrow(assetId);
    return { status: asset.status, progress: null };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

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
    if (parts.length < 2) return 'mp4'; // fallback
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
