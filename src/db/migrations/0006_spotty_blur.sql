CREATE TYPE "app"."lab_booking_status" AS ENUM('requested', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."level_request_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'level_request_received';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'level_decision';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'lab_booking_received';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'lab_booking_decision';--> statement-breakpoint
CREATE TABLE "app"."level_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"requested_level" integer NOT NULL,
	"status" "app"."level_request_status" DEFAULT 'pending' NOT NULL,
	"evidence" text NOT NULL,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."lab_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lab_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"purpose" text NOT NULL,
	"status" "app"."lab_booking_status" DEFAULT 'requested' NOT NULL,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "founder_level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "founder_level_granted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."level_requests" ADD CONSTRAINT "level_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."level_requests" ADD CONSTRAINT "level_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_bookings" ADD CONSTRAINT "lab_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_bookings" ADD CONSTRAINT "lab_bookings_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "level_requests_one_pending_idx" ON "app"."level_requests" USING btree ("user_id") WHERE "app"."level_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "level_requests_status_idx" ON "app"."level_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "level_requests_user_idx" ON "app"."level_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lab_bookings_lab_starts_idx" ON "app"."lab_bookings" USING btree ("lab_id","starts_at");--> statement-breakpoint
CREATE INDEX "lab_bookings_user_idx" ON "app"."lab_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lab_bookings_status_idx" ON "app"."lab_bookings" USING btree ("status");--> statement-breakpoint
--
-- Hand-appended: drizzle-kit cannot express an EXCLUDE constraint, and this is
-- the only thing standing between two managers approving the same room for the
-- same hour. src/server/events/actions.ts enforces event capacity by counting
-- rows and then inserting, which races at the boundary; for a time range the
-- same shape double-books a lab. Let Postgres arbitrate instead.
--
-- Only `approved` rows participate, so any number of founders may ask for the
-- same slot — the clash surfaces at the moment a manager approves the second
-- one, which is exactly when a human is there to be told.
--
-- btree_gist supplies the `=` operator class for the plain lab_id column; the
-- range operator `&&` comes from the built-in gist range support. It is
-- available on stock Postgres 16 and on RDS.
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "app"."lab_bookings" ADD CONSTRAINT "lab_bookings_no_overlap" EXCLUDE USING gist ("lab_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" = 'approved');
