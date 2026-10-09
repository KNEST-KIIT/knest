CREATE TYPE "app"."enquiry_status" AS ENUM('new', 'handled');--> statement-breakpoint
CREATE TYPE "app"."enquiry_topic" AS ENUM('general', 'program', 'partnership', 'mentor', 'press', 'support');--> statement-breakpoint
CREATE TABLE "app"."enquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" "app"."enquiry_topic" DEFAULT 'general' NOT NULL,
	"message" text NOT NULL,
	"status" "app"."enquiry_status" DEFAULT 'new' NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by" text
);
--> statement-breakpoint
ALTER TABLE "app"."enquiries" ADD CONSTRAINT "enquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."enquiries" ADD CONSTRAINT "enquiries_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enquiries_status_created_idx" ON "app"."enquiries" USING btree ("status","created_at");