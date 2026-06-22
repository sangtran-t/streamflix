import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Asset } from '../database/entities/asset.entity';
import { AssetStatus } from '../database/entities/asset-status.enum';
import { Title } from '../database/entities/title.entity';
import { RedisService } from '../redis/redis.service';

/** Status pub/sub channel (per COMMUNICATION.md §1) */
const STATUS_CHANNEL = 'transcode:status';

/** Shape of the status message from the Go worker (COMMUNICATION.md §3) */
interface TranscodeStatusMessage {
  schemaVersion: string;
  assetId: string;
  correlationId: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  progress?: number;
  durationSeconds?: number;
  renditions?: string[];
  hlsMasterKey?: string;
  posterKey?: string;
  errorCode?: string;
  message?: string;
  at: string;
}

@Injectable()
export class StatusSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(StatusSubscriberService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    @InjectRepository(Title)
    private readonly titles: Repository<Title>,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redis.subscribe(STATUS_CHANNEL, (msg) => {
      // Fire-and-forget: errors are logged but must not crash the subscriber.
      this.handleStatusMessage(msg).catch((err: unknown) => {
        this.logger.error(
          `Failed to process status message: ${(err as Error).message}`,
          (err as Error).stack,
        );
      });
    });
  }

  private async handleStatusMessage(raw: string): Promise<void> {
    let msg: TranscodeStatusMessage;
    try {
      msg = JSON.parse(raw) as TranscodeStatusMessage;
    } catch {
      this.logger.warn(`Received non-JSON on ${STATUS_CHANNEL}: ${raw.slice(0, 200)}`);
      return;
    }

    const { assetId, status, correlationId } = msg;
    this.logger.log(
      `Status update assetId=${assetId} status=${status} correlationId=${correlationId}`,
    );

    const asset = await this.assets.findOne({
      where: { id: assetId },
      relations: ['title'],
    });
    if (!asset) {
      this.logger.warn(`Status update for unknown assetId=${assetId} — ignoring`);
      return;
    }

    switch (status) {
      case 'processing':
        await this.assets.update(asset.id, { status: AssetStatus.Processing });
        break;

      case 'ready':
        await this.handleReady(asset, msg);
        break;

      case 'failed':
        await this.assets.update(asset.id, {
          status: AssetStatus.Failed,
          statusMessage: msg.errorCode
            ? `${msg.errorCode}: ${msg.message ?? ''}`
            : (msg.message ?? 'transcoding failed'),
        });
        break;

      default:
        this.logger.warn(`Unknown status "${status}" for asset=${assetId}`);
    }
  }

  private async handleReady(asset: Asset, msg: TranscodeStatusMessage): Promise<void> {
    await this.assets.update(asset.id, {
      status: AssetStatus.Ready,
      hlsMasterPath: msg.hlsMasterKey ?? null,
      durationSeconds: msg.durationSeconds ?? null,
      statusMessage: null,
    });

    const titleUpdate: Partial<Title> = {};
    if (msg.durationSeconds != null) {
      titleUpdate.runtimeSeconds = msg.durationSeconds;
    }

    // posterKey is "hls/{assetId}/poster.jpg"; EDGE_BASE already includes "/hls",
    // so we strip the leading "hls/" to avoid a double-hls URL.
    if (msg.posterKey) {
      const edgeBase = (process.env.EDGE_BASE ?? 'http://localhost:8080/hls').replace(/\/$/, '');
      const relPath = msg.posterKey.startsWith('hls/')
        ? msg.posterKey.slice('hls/'.length)
        : msg.posterKey;
      titleUpdate.posterImageUrl = `${edgeBase}/${relPath}`;
    }

    if (Object.keys(titleUpdate).length > 0) {
      await this.titles.update(asset.titleId, titleUpdate);
    }

    this.logger.log(
      `Asset ${asset.id} ready — hls=${msg.hlsMasterKey} duration=${msg.durationSeconds}s`,
    );
  }
}
