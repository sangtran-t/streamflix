import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetStatus } from '../database/entities/asset-status.enum';
import { Asset } from '../database/entities/asset.entity';
import { Title } from '../database/entities/title.entity';

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

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Title)
    private readonly titles: Repository<Title>,
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

  private toSummary(title: Title): TitleSummary {
    // In v1 a title has at most one asset; pick the first ready one, else first.
    const asset: Asset | undefined =
      title.assets?.find((a) => a.status === AssetStatus.Ready) ??
      title.assets?.[0];

    return {
      id: title.id,
      slug: title.slug,
      name: title.name,
      synopsis: title.synopsis,
      year: title.year,
      runtimeSeconds: title.runtimeSeconds,
      heroImageUrl: title.heroImageUrl,
      posterImageUrl: title.posterImageUrl,
      genres: title.genres?.map((g) => g.name) ?? [],
      assetId: asset?.id ?? null,
      assetStatus: asset?.status ?? null,
    };
  }
}
