CREATE TYPE "app"."application_field_type" AS ENUM('text', 'textarea', 'select', 'multiselect', 'url', 'file');--> statement-breakpoint
CREATE TYPE "app"."application_status" AS ENUM('draft', 'submitted', 'under_review', 'shortlisted', 'interview', 'accepted', 'rejected', 'waitlisted');--> statement-breakpoint
CREATE TYPE "app"."notification_type" AS ENUM('application_received', 'application_status_changed', 'application_deadline_reminder');--> statement-breakpoint
CREATE TABLE "app"."application_answers" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"question_id" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."application_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"question_id" text NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"program_id" integer NOT NULL,
	"status" "app"."application_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"decision_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "app"."notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"application_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."application_answers" ADD CONSTRAINT "application_answers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "app"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."application_documents" ADD CONSTRAINT "application_documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "app"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "app"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_answers_app_question_idx" ON "app"."application_answers" USING btree ("application_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_documents_app_question_idx" ON "app"."application_documents" USING btree ("application_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_user_program_idx" ON "app"."applications" USING btree ("user_id","program_id");--> statement-breakpoint
CREATE INDEX "applications_program_idx" ON "app"."applications" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "app"."applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "app"."audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "app"."notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "app"."notifications" USING btree ("user_id","read_at");