CREATE TYPE "app"."lab_qr_check_state" AS ENUM('partial_staff', 'partial_student', 'verified');--> statement-breakpoint
CREATE TYPE "app"."lab_scan_action" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "app"."lab_scan_side" AS ENUM('staff', 'student');--> statement-breakpoint
CREATE TYPE "app"."lab_scan_status" AS ENUM('accepted', 'review', 'rejected');--> statement-breakpoint
CREATE TABLE "app"."lab_device_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"public_key" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"revoked_reason" text,
	CONSTRAINT "lab_device_keys_id_shape" CHECK (char_length("app"."lab_device_keys"."id") = 16)
);
--> statement-breakpoint
CREATE TABLE "app"."lab_qr_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"action" "app"."lab_scan_action" NOT NULL,
	"state" "app"."lab_qr_check_state" NOT NULL,
	"staff_event_id" text,
	"student_event_id" text,
	"verified_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_qr_checks_verified_has_both" CHECK ("app"."lab_qr_checks"."state" <> 'verified' or ("app"."lab_qr_checks"."staff_event_id" is not null and "app"."lab_qr_checks"."student_event_id" is not null and "app"."lab_qr_checks"."verified_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "app"."lab_scan_events" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"side" "app"."lab_scan_side" NOT NULL,
	"action" "app"."lab_scan_action" NOT NULL,
	"scanner_user_id" text NOT NULL,
	"scanner_key_id" text NOT NULL,
	"inner_key_id" text,
	"inner_user_id" text,
	"inner_nonce" text,
	"inner_step" bigint,
	"token" text NOT NULL,
	"status" "app"."lab_scan_status" NOT NULL,
	"code" text,
	"client_at_ms" bigint NOT NULL,
	"client_sync_at_ms" bigint NOT NULL,
	"effective_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	CONSTRAINT "lab_scan_events_client_times" CHECK ("app"."lab_scan_events"."client_at_ms" > 0 and "app"."lab_scan_events"."client_sync_at_ms" > 0)
);
--> statement-breakpoint
ALTER TABLE "app"."lab_device_keys" ADD CONSTRAINT "lab_device_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_device_keys" ADD CONSTRAINT "lab_device_keys_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_qr_checks" ADD CONSTRAINT "lab_qr_checks_booking_id_lab_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "app"."lab_bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_qr_checks" ADD CONSTRAINT "lab_qr_checks_staff_event_id_lab_scan_events_id_fk" FOREIGN KEY ("staff_event_id") REFERENCES "app"."lab_scan_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_qr_checks" ADD CONSTRAINT "lab_qr_checks_student_event_id_lab_scan_events_id_fk" FOREIGN KEY ("student_event_id") REFERENCES "app"."lab_scan_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_scan_events" ADD CONSTRAINT "lab_scan_events_booking_id_lab_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "app"."lab_bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_scan_events" ADD CONSTRAINT "lab_scan_events_scanner_user_id_users_id_fk" FOREIGN KEY ("scanner_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."lab_scan_events" ADD CONSTRAINT "lab_scan_events_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lab_device_keys_user_idx" ON "app"."lab_device_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_device_keys_public_key_idx" ON "app"."lab_device_keys" USING btree ("public_key");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_qr_checks_booking_action_idx" ON "app"."lab_qr_checks" USING btree ("booking_id","action");--> statement-breakpoint
CREATE INDEX "lab_scan_events_booking_idx" ON "app"."lab_scan_events" USING btree ("booking_id","action");--> statement-breakpoint
CREATE INDEX "lab_scan_events_review_idx" ON "app"."lab_scan_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "lab_scan_events_scanner_idx" ON "app"."lab_scan_events" USING btree ("scanner_user_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_scan_events_staff_nonce_idx" ON "app"."lab_scan_events" USING btree ("inner_key_id","inner_nonce") WHERE "app"."lab_scan_events"."side" = 'staff' and "app"."lab_scan_events"."status" <> 'rejected';--> statement-breakpoint
CREATE UNIQUE INDEX "lab_scan_events_student_nonce_idx" ON "app"."lab_scan_events" USING btree ("scanner_key_id","inner_nonce") WHERE "app"."lab_scan_events"."side" = 'student' and "app"."lab_scan_events"."status" <> 'rejected';