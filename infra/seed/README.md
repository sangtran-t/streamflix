# Seed strategy (resolves review C3)

Seeding has two halves: **catalog metadata** (rows in Postgres) and **media bytes**
(objects in MinIO). They are kept separate so the database can be seeded fast and
deterministically without depending on large media downloads.

## 1. Catalog metadata — `api/src/database/seed.ts`

Idempotent upserts of genres, CC-BY titles, and their assets via TypeORM
(ADR-0009). Re-running never duplicates rows (every row has a fixed id;
`repository.save()` upserts by PK). Run it after migrating:

```bash
pnpm migrate
pnpm seed
```

One asset (`Big Buck Bunny`) is marked `ready` with an `hls_master_path` so the
Phase-1 playback slice works against a **pre-transcoded** package — no ffmpeg
needed. Other titles are seeded as `queued` (their bytes get transcoded on demand
via the Phase-2 upload flow).

## 2. Media bytes — clips in `infra/seed/clips/`

Large media is **never committed to git** (see `.gitignore`, docs/PLAN.md §12).
Instead:

- Short CC clips are fetched via a documented, checksummed download step (added in
  Phase 1 alongside the playback slice). Place them under `infra/seed/clips/`.
- The one pre-transcoded title is uploaded as an HLS package to the MinIO bucket
  under `hls/<assetId>/…` matching the `hls_master_path` written by the seed.

All titles, authors, licenses, and source URLs are recorded in `CREDITS.md`
(CC-BY requires visible attribution).

### Why not download inside the seed script?

Network downloads inside a seed are flaky and may be blocked in CI/containers
(review C3). Keeping the download as an explicit, checksummed, resumable step that
writes into MinIO avoids coupling DB seeding to network availability.

> Phase 0 ships the metadata seed + this strategy. The clip download script and
> the committed pre-transcoded HLS land with the Phase-1 vertical slice.
