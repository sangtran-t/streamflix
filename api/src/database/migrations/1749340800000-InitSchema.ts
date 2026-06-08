import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Initial schema. Written explicitly (not auto-generated) so the DDL —
 * including the CITEXT email column and the tsvector GIN index — is fully
 * under source control. UUID PKs use gen_random_uuid() (PostgreSQL 13+).
 */
export class InitSchema1749340800000 implements MigrationInterface {
  name = 'InitSchema1749340800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);

    await queryRunner.query(
      `CREATE TYPE "asset_status_enum" AS ENUM ('queued', 'processing', 'ready', 'failed')`,
    );

    await queryRunner.query(`
      CREATE TABLE "user" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "email"         citext NOT NULL,
        "password_hash" text NOT NULL,
        "display_name"  text NOT NULL,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "user_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "user_email_key" ON "user" ("email")`);

    await queryRunner.query(`
      CREATE TABLE "title" (
        "id"               uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug"             text NOT NULL,
        "name"             text NOT NULL,
        "synopsis"         text NOT NULL,
        "year"             integer NOT NULL,
        "runtime_seconds"  integer,
        "hero_image_url"   text,
        "poster_image_url" text,
        "popularity"       integer NOT NULL DEFAULT 0,
        "search_vector"    tsvector,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "title_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "title_slug_key" ON "title" ("slug")`);
    await queryRunner.query(`CREATE INDEX "title_popularity_idx" ON "title" ("popularity")`);
    await queryRunner.query(
      `CREATE INDEX "title_search_vector_idx" ON "title" USING GIN ("search_vector")`,
    );

    await queryRunner.query(`
      CREATE TABLE "genre" (
        "id"   uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        CONSTRAINT "genre_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "genre_name_key" ON "genre" ("name")`);

    await queryRunner.query(`
      CREATE TABLE "title_genre" (
        "title_id" uuid NOT NULL,
        "genre_id" uuid NOT NULL,
        CONSTRAINT "title_genre_pkey" PRIMARY KEY ("title_id", "genre_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "title_genre_genre_id_idx" ON "title_genre" ("genre_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "asset" (
        "id"               uuid NOT NULL DEFAULT gen_random_uuid(),
        "title_id"         uuid NOT NULL,
        "source_url"       text,
        "status"           "asset_status_enum" NOT NULL DEFAULT 'queued',
        "status_message"   text,
        "hls_master_path"  text,
        "duration_seconds" integer,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "asset_status_idx" ON "asset" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "watch_progress" (
        "user_id"          uuid NOT NULL,
        "title_id"         uuid NOT NULL,
        "position_seconds" integer NOT NULL DEFAULT 0,
        "completed"        boolean NOT NULL DEFAULT false,
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "watch_progress_pkey" PRIMARY KEY ("user_id", "title_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "watch_progress_user_id_updated_at_idx" ON "watch_progress" ("user_id", "updated_at" DESC)`,
    );

    await queryRunner.query(
      `ALTER TABLE "title_genre" ADD CONSTRAINT "title_genre_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "title"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "title_genre" ADD CONSTRAINT "title_genre_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genre"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset" ADD CONSTRAINT "asset_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "title"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "title"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "watch_progress"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "title_genre"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "genre"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "title"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "asset_status_enum"`);
  }
}
