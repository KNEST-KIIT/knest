import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."lab_bookings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."lab_bookings" CASCADE;
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_lab_bookings_fk";
  
  DROP INDEX IF EXISTS "cms"."payload_locked_documents_rels_lab_bookings_id_idx";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "lab_bookings_id";
  DROP TYPE "cms"."enum_lab_bookings_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_lab_bookings_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TABLE "cms"."lab_bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"infrastructure_id" integer NOT NULL,
  	"user_id" varchar NOT NULL,
  	"user_email" varchar NOT NULL,
  	"start_time" timestamp(3) with time zone NOT NULL,
  	"end_time" timestamp(3) with time zone NOT NULL,
  	"status" "cms"."enum_lab_bookings_status" DEFAULT 'pending' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "lab_bookings_id" integer;
  ALTER TABLE "cms"."lab_bookings" ADD CONSTRAINT "lab_bookings_infrastructure_id_infrastructure_id_fk" FOREIGN KEY ("infrastructure_id") REFERENCES "cms"."infrastructure"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "lab_bookings_infrastructure_idx" ON "cms"."lab_bookings" USING btree ("infrastructure_id");
  CREATE INDEX "lab_bookings_updated_at_idx" ON "cms"."lab_bookings" USING btree ("updated_at");
  CREATE INDEX "lab_bookings_created_at_idx" ON "cms"."lab_bookings" USING btree ("created_at");
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lab_bookings_fk" FOREIGN KEY ("lab_bookings_id") REFERENCES "cms"."lab_bookings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_lab_bookings_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("lab_bookings_id");`)
}
