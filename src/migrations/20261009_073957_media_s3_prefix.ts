import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."media" ADD COLUMN "prefix" varchar DEFAULT 'media';
  ALTER TABLE "cms"."media" ADD COLUMN "_objectkey" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."media" DROP COLUMN "prefix";
  ALTER TABLE "cms"."media" DROP COLUMN "_objectkey";`)
}
