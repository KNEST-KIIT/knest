CREATE TABLE "app"."analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"session_id" text NOT NULL,
	"event" text NOT NULL,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_event_idx" ON "app"."analytics_events" USING btree ("event");--> statement-breakpoint
CREATE INDEX "analytics_events_user_idx" ON "app"."analytics_events" USING btree ("user_id");