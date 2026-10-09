-- Needed for the exclusion constraint below (equality on text inside a GiST index).
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "app"."lab_attendance_outcome" AS ENUM('attended', 'no_show');--> statement-breakpoint
CREATE TYPE "app"."lab_booking_status" AS ENUM('requested', 'approved', 'rejected', 'cancelled', 'alternative_proposed', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "app"."lab_eligibility" AS ENUM('verified', 'onboarded');--> statement-breakpoint
CREATE TYPE "app"."lab_staff_role" AS ENUM('head', 'assistant');--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'booking_requested';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'booking_decided';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'booking_alternative';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'booking_cancelled';--> statement-breakpoint
CREATE TABLE "app"."lab_attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"outcome" "app"."lab_attendance_outcome" NOT NULL,
	"marked_by" text,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"method" text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."lab_blackouts" (
	"id" text PRIMARY KEY NOT NULL,
	"lab_id" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	CONSTRAINT "lab_blackouts_order" CHECK ("app"."lab_blackouts"."ends_on" >= "app"."lab_blackouts"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "app"."lab_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"lab_id" text NOT NULL,
	"user_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"purpose" text NOT NULL,
	"headcount" integer DEFAULT 1 NOT NULL,
	"equipment" text,
	"status" "app"."lab_booking_status" DEFAULT 'requested' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"proposed_starts_at" timestamp with time zone,
	"proposed_ends_at" timestamp with time zone,
	"assistant_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_bookings_time_order" CHECK ("app"."lab_bookings"."ends_at" > "app"."lab_bookings"."starts_at"),
	CONSTRAINT "lab_bookings_headcount" CHECK ("app"."lab_bookings"."headcount" > 0),
	CONSTRAINT "lab_bookings_proposal_order" CHECK ("app"."lab_bookings"."proposed_starts_at" is null or "app"."lab_bookings"."proposed_ends_at" > "app"."lab_bookings"."proposed_starts_at")
);
--> statement-breakpoint
CREATE TABLE "app"."lab_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"lab_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"opens_minute" integer NOT NULL,
	"closes_minute" integer NOT NULL,
	CONSTRAINT "lab_hours_weekday" CHECK ("app"."lab_hours"."weekday" between 0 and 6),
	CONSTRAINT "lab_hours_window" CHECK ("app"."lab_hours"."opens_minute" >= 0 and "app"."lab_hours"."closes_minute" <= 1440 and "app"."lab_hours"."opens_minute" < "app"."lab_hours"."closes_minute")
);
--> statement-breakpoint
CREATE TABLE "app"."lab_staff" (
	"id" text PRIMARY KEY NOT NULL,
	"lab_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "app"."lab_staff_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."labs" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"description" text,
	"infrastructure_id" integer,
	"capacity" integer DEFAULT 1 NOT NULL,
	"slot_minutes" integer DEFAULT 60 NOT NULL,
	"max_consecutive_slots" integer DEFAULT 3 NOT NULL,
	"min_lead_minutes" integer DEFAULT 240 NOT NULL,
	"max_horizon_days" integer DEFAULT 14 NOT NULL,
	"max_open_requests" integer DEFAULT 3 NOT NULL,
	"max_hours_per_week" integer DEFAULT 6 NOT NULL,
	"cancel_cutoff_minutes" integer DEFAULT 120 NOT NULL,
	"eligibility" "app"."lab_eligibility" DEFAULT 'onboarded' NOT NULL,
	"requires_assistant" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labs_capacity_positive" CHECK ("app"."labs"."capacity" > 0),
	CONSTRAINT "labs_slot_minutes_range" CHECK ("app"."labs"."slot_minutes" between 15 and 480),
	CONSTRAINT "labs_policy_positive" CHECK ("app"."labs"."max_consecutive_slots" > 0 and "app"."labs"."min_lead_minutes" >= 0 and "app"."labs"."max_horizon_days" > 0 and "app"."labs"."max_open_requests" > 0 and "app"."labs"."max_hours_per_week" > 0 and "app"."labs"."cancel_cutoff_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app"."lab_attendance" ADD CONSTRAINT "lab_attendance_booking_id_lab_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "app"."lab_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_attendance" ADD CONSTRAINT "lab_attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_blackouts" ADD CONSTRAINT "lab_blackouts_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "app"."labs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_bookings" ADD CONSTRAINT "lab_bookings_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "app"."labs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_bookings" ADD CONSTRAINT "lab_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_bookings" ADD CONSTRAINT "lab_bookings_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_bookings" ADD CONSTRAINT "lab_bookings_assistant_user_id_users_id_fk" FOREIGN KEY ("assistant_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_hours" ADD CONSTRAINT "lab_hours_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "app"."labs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_staff" ADD CONSTRAINT "lab_staff_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "app"."labs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_staff" ADD CONSTRAINT "lab_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lab_attendance_booking_idx" ON "app"."lab_attendance" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "lab_blackouts_lab_idx" ON "app"."lab_blackouts" USING btree ("lab_id","starts_on");--> statement-breakpoint
CREATE INDEX "lab_bookings_lab_start_idx" ON "app"."lab_bookings" USING btree ("lab_id","starts_at");--> statement-breakpoint
CREATE INDEX "lab_bookings_user_idx" ON "app"."lab_bookings" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "lab_bookings_status_idx" ON "app"."lab_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lab_bookings_assistant_idx" ON "app"."lab_bookings" USING btree ("assistant_user_id","starts_at");--> statement-breakpoint
CREATE INDEX "lab_hours_lab_idx" ON "app"."lab_hours" USING btree ("lab_id","weekday");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_staff_lab_user_idx" ON "app"."lab_staff" USING btree ("lab_id","user_id");--> statement-breakpoint
CREATE INDEX "lab_staff_user_idx" ON "app"."lab_staff" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "labs_slug_idx" ON "app"."labs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "labs_infrastructure_idx" ON "app"."labs" USING btree ("infrastructure_id");--> statement-breakpoint
-- Double booking is impossible in the database: two live bookings of one lab may not overlap in time.
-- A rejected, cancelled, completed or no-show booking releases its slot. Drizzle cannot express this, so it is written by hand.
ALTER TABLE "app"."lab_bookings" ADD CONSTRAINT "lab_bookings_no_overlap" EXCLUDE USING gist ("lab_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" IN ('requested', 'approved', 'alternative_proposed'));
