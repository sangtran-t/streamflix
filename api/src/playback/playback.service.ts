import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetStatus } from '../database/entities/asset-status.enum';
import { Asset } from '../database/entities/asset.entity';
import { SigningService } from './signing.service';

export interface PlaybackUrlResponse {
  masterUrl: string;
  expiresAt: string; // ISO-8601
}

@Injectable()
export class PlaybackService {
  private readonly edgeBase: string;

  constructor(
    @InjectRepository(Asset)
    private readonly assets: Repository<Asset>,
    private readonly signing: SigningService,
  ) {
    // EDGE_BASE is the base URL the browser uses to reach the delivery edge.
    // Behind the dev proxy this is http://localhost:8080/hls (no trailing slash).
    this.edgeBase = (process.env['EDGE_BASE'] ?? 'http://localhost:8080/hls').replace(/\/$/, '');
  }

  async getPlaybackUrl(
    userId: string,
    assetId: string,
  ): Promise<{ cookieValue: string; cookiePath: string; response: PlaybackUrlResponse }> {
    const asset = await this.assets.findOne({ where: { id: assetId } });
    if (!asset) throw new NotFoundException(`Asset not found: ${assetId}`);
    if (asset.status !== AssetStatus.Ready) {
      throw new UnprocessableEntityException(
        `Asset ${assetId} is not ready (status: ${asset.status})`,
      );
    }

    const { cookie, expiresAt } = this.signing.buildCookie(userId, assetId);

    const masterUrl = `${this.edgeBase}/${assetId}/master.m3u8`;

    return {
      cookieValue: cookie,
      cookiePath: `/hls/${assetId}`,
      response: {
        masterUrl,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }
}
