import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Phase 3 schema additions:
 * - refresh_token table for httpOnly cookie-based refresh flow (API.md §Auth)
 */
export class Phase3Schema1749340800002 implements MigrationInterface {
  name = 'Phase3Schema1749340800002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_token" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL,
        "token_hash" text        NOT NULL,
        "family"     uuid        NOT NULL,
        "revoked"    boolean     NOT NULL DEFAULT false,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "refresh_token_hash_idx" ON "refresh_token" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "refresh_token_family_idx" ON "refresh_token" ("family")`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey"
       FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_token"`);
  }
}
