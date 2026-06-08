/**
 * Idempotent seed script. Uses fixed UUIDs and repository.save() (upsert by PK)
 * so re-running never produces duplicates. Media files are not seeded here —
 * see infra/seed/README.md. Content attributions live in CREDITS.md.
 */
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Asset } from './entities/asset.entity';
import { AssetStatus } from './entities/asset-status.enum';
import { Genre } from './entities/genre.entity';
import { Title } from './entities/title.entity';

const GENRES = [
  { id: '00000000-0000-4000-a000-000000000001', name: 'Animation' },
  { id: '00000000-0000-4000-a000-000000000002', name: 'Sci-Fi' },
  { id: '00000000-0000-4000-a000-000000000003', name: 'Adventure' },
  { id: '00000000-0000-4000-a000-000000000004', name: 'Fantasy' },
  { id: '00000000-0000-4000-a000-000000000005', name: 'Short' },
];

interface SeedTitle {
  id: string;
  slug: string;
  name: string;
  synopsis: string;
  year: number;
  genres: string[];
  asset: {
    id: string;
    status: AssetStatus;
    hlsMasterPath?: string;
    durationSeconds?: number;
  };
}

const TITLES: SeedTitle[] = [
  {
    id: '10000000-0000-4000-b000-000000000001',
    slug: 'big-buck-bunny',
    name: 'Big Buck Bunny',
    synopsis:
      'A large, good-natured rabbit takes revenge on three rodents who torment him. Blender Foundation open movie (CC-BY).',
    year: 2008,
    genres: ['Animation', 'Short', 'Adventure'],
    asset: {
      id: '20000000-0000-4000-c000-000000000001',
      status: AssetStatus.Ready,
      hlsMasterPath: 'hls/20000000-0000-4000-c000-000000000001/master.m3u8',
      durationSeconds: 596,
    },
  },
  {
    id: '10000000-0000-4000-b000-000000000002',
    slug: 'sintel',
    name: 'Sintel',
    synopsis:
      'A lonely young woman searches for the dragon she befriended as a hatchling. Blender Foundation open movie (CC-BY).',
    year: 2010,
    genres: ['Animation', 'Fantasy', 'Adventure'],
    asset: { id: '20000000-0000-4000-c000-000000000002', status: AssetStatus.Queued },
  },
  {
    id: '10000000-0000-4000-b000-000000000003',
    slug: 'tears-of-steel',
    name: 'Tears of Steel',
    synopsis:
      'In a future Amsterdam, warriors and scientists try to save the world from destructive robots. Blender Foundation open movie (CC-BY).',
    year: 2012,
    genres: ['Sci-Fi', 'Short'],
    asset: { id: '20000000-0000-4000-c000-000000000003', status: AssetStatus.Queued },
  },
];

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const genres = AppDataSource.getRepository(Genre);
  const titles = AppDataSource.getRepository(Title);
  const assets = AppDataSource.getRepository(Asset);

  await genres.save(GENRES);
  const byName = new Map((await genres.find()).map((g) => [g.name, g]));

  for (const t of TITLES) {
    await titles.save({
      id: t.id,
      slug: t.slug,
      name: t.name,
      synopsis: t.synopsis,
      year: t.year,
      runtimeSeconds: t.asset.durationSeconds ?? null,
      genres: t.genres.map((name) => {
        const g = byName.get(name);
        if (!g) throw new Error(`unknown seed genre: ${name}`);
        return g;
      }),
    });

    await assets.save({
      id: t.asset.id,
      titleId: t.id,
      status: t.asset.status,
      hlsMasterPath: t.asset.hlsMasterPath ?? null,
      durationSeconds: t.asset.durationSeconds ?? null,
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ level: 'log', service: 'seed', msg: 'seed complete', titles: TITLES.length }),
  );

  await AppDataSource.destroy();
}

main().catch(async (err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: 'error', service: 'seed', msg: String(err) }));
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exit(1);
});
