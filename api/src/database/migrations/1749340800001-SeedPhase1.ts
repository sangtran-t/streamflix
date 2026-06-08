import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase 1 seed data.
 *
 * Inserts a "Big Buck Bunny" title + asset with pinned UUIDs so the
 * vertical slice works immediately after `docker compose up`.
 *
 * Asset UUID matches ASSET_ID in scripts/seed-hls.sh.
 *
 * The migration deletes any existing BBB rows first so it is safe to run
 * against a volume that has stale data from a previous partial run.
 * FK ON DELETE CASCADE handles title_genre and asset automatically.
 */
export class SeedPhase11749340800001 implements MigrationInterface {
  name = 'SeedPhase11749340800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove stale rows that might exist with wrong UUIDs from a previous run.
    // ON DELETE CASCADE propagates to title_genre and asset.
    await queryRunner.query(`DELETE FROM title WHERE slug = 'big-buck-bunny'`);
    await queryRunner.query(`DELETE FROM genre WHERE name = 'Animation'`);

    // Genre
    await queryRunner.query(`
      INSERT INTO genre (id, name)
      VALUES ('20000000-0000-4000-a000-000000000001', 'Animation')
    `);

    // Title
    await queryRunner.query(`
      INSERT INTO title (id, slug, name, synopsis, year, runtime_seconds, popularity)
      VALUES (
        '20000000-0000-4000-b000-000000000001',
        'big-buck-bunny',
        'Big Buck Bunny',
        'A large and loveable rabbit deals with three tiny bullies, animated in CGI.',
        2008,
        596,
        100
      )
    `);

    // Title ↔ Genre
    await queryRunner.query(`
      INSERT INTO title_genre (title_id, genre_id)
      VALUES (
        '20000000-0000-4000-b000-000000000001',
        '20000000-0000-4000-a000-000000000001'
      )
    `);

    // Asset — status=ready so the playback endpoint issues the signed cookie.
    await queryRunner.query(`
      INSERT INTO asset (id, title_id, status, hls_master_path)
      VALUES (
        '20000000-0000-4000-c000-000000000001',
        '20000000-0000-4000-b000-000000000001',
        'ready',
        'hls/20000000-0000-4000-c000-000000000001/master.m3u8'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM title WHERE id = '20000000-0000-4000-b000-000000000001'`);
    await queryRunner.query(`DELETE FROM genre WHERE id = '20000000-0000-4000-a000-000000000001'`);
  }
}
