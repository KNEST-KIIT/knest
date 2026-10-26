import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."testimonials" ALTER COLUMN "consent_given" DROP NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "cms"."testimonials" SET "consent_given" = false WHERE "consent_given" IS NULL;
   ALTER TABLE "cms"."testimonials" ALTER COLUMN "consent_given" SET NOT NULL;`)
}
