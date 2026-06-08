import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Adds a `role` column to the `user` table.
 * All existing rows default to 'user'. Promote to 'admin' manually:
 *   UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
 */
export class AddUserRole1749340800003 implements MigrationInterface {
  name = 'AddUserRole1749340800003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
        ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "role"`);
  }
}
