import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetStatus } from '../database/entities/asset-status.enum';
import { Asset } from '../database/entities/asset.entity';
import { Title } from '../database/entities/title.entity';
import { WatchProgress } from '../database/entities/watch-progress.entity';

export interface TitleSummary {
  id: string;
  slug: string;
  name: string;
  synopsis: string;
  year: number;
  runtimeSeconds: number | null;
  heroImageUrl: string | null;
  posterImageUrl: string | null;
  genres: string[];
  assetId: string | null;
  assetStatus: AssetStatus | null;
}

export interface HomeRow {
  title: string;
  items: TitleSummary[];
}

export interface HomeResponse {
  hero: TitleSummary | null;
  rows: HomeRow[];
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Title)
    private readonly titles: Repository<Title>,
    @InjectRepository(WatchProgress)
    private readonly progress: Repository<WatchProgress>,
  ) {}

  async listTitles(): Promise<TitleSummary[]> {
    const rows = await this.titles.find({
      relations: ['genres', 'assets'],
      order: { popularity: 'DESC', createdAt: 'ASC' },
    });
    return rows.map((t) => this.toSummary(t));
  }

  async getTitleBySlug(slug: string): Promise<TitleSummary> {
    const title = await this.titles.findOne({
      where: { slug },
      relations: ['genres', 'assets'],
    });
    if (!title) throw new NotFoundException(`Title not found: ${slug}`);
    return this.toSummary(title);
  }

  /**
   * Build the home-page response: a hero (most popular ready title) +
   * optional Continue Watching row + Trending + New Arrivals rows.
   */
  async getHome(userId?: string): Promise<HomeResponse> {
    const all = await this.titles.find({
      relations: ['genres', 'assets'],
      order: { popularity: 'DESC', createdAt: 'DESC' },
    });

    const summaries = all.map((t) => this.toSummary(t));
    const ready = summaries.filter((t) => t.assetStatus === AssetStatus.Ready);

    const hero = ready[0] ?? null;

    const rows: HomeRow[] = [];

    // Continue Watching — requires auth + at least one progress record.
    if (userId) {
      const progressRows = await this.progress.find({
        where: { userId, completed: false },
        relations: ['title', 'title.assets', 'title.genres'],
        order: { updatedAt: 'DESC' },
        take: 20,
      });

      const continueItems: TitleSummary[] = progressRows
        .map((p) => {
          if (!p.title) return null;
          return this.toSummary(p.title);
        })
        .filter((s): s is TitleSummary => s !== null && s.assetStatus === AssetStatus.Ready);

      if (continueItems.length > 0) {
        rows.push({ title: 'Continue Watching', items: continueItems });
      }
    }

    if (ready.length > 0) {
      rows.push({ title: 'Trending Now', items: ready.slice(0, 20) });
    }

    const newArrivals = summaries
      .filter((t) => t.assetStatus === AssetStatus.Ready)
      .reverse()
      .slice(0, 20);
    if (newArrivals.length > 0) {
      rows.push({ title: 'New Arrivals', items: newArrivals });
    }

    const genreMap = new Map<string, TitleSummary[]>();
    for (const t of ready) {
      for (const g of t.genres) {
        if (!genreMap.has(g)) genreMap.set(g, []);
        genreMap.get(g)!.push(t);
      }
    }
    for (const [genre, items] of genreMap) {
      if (items.length >= 2) {
        rows.push({ title: genre, items: items.slice(0, 20) });
      }
    }

    return { hero, rows };
  }

  private toSummary(title: Title): TitleSummary {
    const asset: Asset | undefined =
      title.assets?.find((a) => a.status === AssetStatus.Ready) ?? title.assets?.[0];

    return {
      id: title.id,
      slug: title.slug,
      name: title.name,
      synopsis: title.synopsis,
      year: title.year,
      runtimeSeconds: title.runtimeSeconds ?? null,
      heroImageUrl: title.heroImageUrl ?? null,
      posterImageUrl: title.posterImageUrl ?? null,
      genres: title.genres?.map((g) => g.name) ?? [],
      assetId: asset?.id ?? null,
      assetStatus: asset?.status ?? null,
    };
  }
}
