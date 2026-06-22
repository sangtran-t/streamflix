import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetStatus } from '../database/entities/asset-status.enum';
import { Title } from '../database/entities/title.entity';
import { WatchProgress } from '../database/entities/watch-progress.entity';

export interface ProgressItem {
  titleId: string;
  titleSlug: string;
  titleName: string;
  assetId: string | null;
  positionSeconds: number;
  completed: boolean;
  updatedAt: Date;
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(WatchProgress)
    private readonly progress: Repository<WatchProgress>,
    @InjectRepository(Title)
    private readonly titles: Repository<Title>,
  ) {}

  /** Return the user's watch progress sorted most-recent-first. */
  async getProgress(userId: string): Promise<ProgressItem[]> {
    const rows = await this.progress.find({
      where: { userId },
      relations: ['title', 'title.assets'],
      order: { updatedAt: 'DESC' },
    });

    return rows.map((row) => {
      const readyAsset = row.title?.assets?.find((a) => a.status === AssetStatus.Ready);
      return {
        titleId: row.titleId,
        titleSlug: row.title?.slug ?? '',
        titleName: row.title?.name ?? '',
        assetId: readyAsset?.id ?? null,
        positionSeconds: row.positionSeconds,
        completed: row.completed,
        updatedAt: row.updatedAt,
      };
    });
  }

  async upsertProgress(userId: string, titleId: string, positionSeconds: number): Promise<void> {
    const title = await this.titles.findOne({
      where: { id: titleId },
      relations: ['assets'],
    });
    const runtimeSeconds = title?.runtimeSeconds ?? null;

    const completed = runtimeSeconds !== null && positionSeconds >= runtimeSeconds * 0.9;

    await this.progress
      .createQueryBuilder()
      .insert()
      .into(WatchProgress)
      .values({ userId, titleId, positionSeconds, completed })
      .orUpdate(['position_seconds', 'completed', 'updated_at'], ['user_id', 'title_id'])
      .execute();
  }

  /** Return the saved position for a single (user, title) pair — 0 if none. */
  async getPosition(userId: string, titleId: string): Promise<number> {
    const row = await this.progress.findOne({ where: { userId, titleId } });
    return row?.positionSeconds ?? 0;
  }
}
