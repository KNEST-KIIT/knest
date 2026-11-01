CREATE TYPE "app"."hackathon_announcement_type" AS ENUM('info', 'success', 'warning', 'deadline', 'winner');--> statement-breakpoint
CREATE TYPE "app"."hackathon_status" AS ENUM('draft', 'open', 'building', 'judging', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "app"."hackathon_submission_status" AS ENUM('draft', 'submitted', 'disqualified');--> statement-breakpoint
CREATE TYPE "app"."team_member_role" AS ENUM('leader', 'member');--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'hackathon_registered';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'hackathon_team_joined';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'hackathon_team_left';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'hackathon_submission_received';--> statement-breakpoint
ALTER TYPE "app"."notification_type" ADD VALUE 'hackathon_result_announced';--> statement-breakpoint
CREATE TABLE "app"."hackathon_announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"hackathon_id" text NOT NULL,
	"author_id" text NOT NULL,
	"hackathon_announcement_type" "app"."hackathon_announcement_type" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"webhook_dispatched" boolean DEFAULT false NOT NULL,
	"webhook_dispatched_at" timestamp with time zone,
	"email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."hackathon_community_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"hackathon_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."hackathon_events" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" integer,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"tagline" text,
	"description" text,
	"banner_image_key" text,
	"organizer_id" text NOT NULL,
	"status" "app"."hackathon_status" DEFAULT 'draft' NOT NULL,
	"min_team_size" integer DEFAULT 1 NOT NULL,
	"max_team_size" integer DEFAULT 4 NOT NULL,
	"allow_solo" boolean DEFAULT true NOT NULL,
	"registrations_open_at" timestamp with time zone,
	"registrations_close_at" timestamp with time zone,
	"submissions_open_at" timestamp with time zone,
	"submissions_close_at" timestamp with time zone,
	"prize_pool_summary" text,
	"tracks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"judging_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discord_webhook_url" text,
	"telegram_bot_token" text,
	"telegram_chat_id" text,
	"gallery_public" boolean DEFAULT false NOT NULL,
	"community_voting_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hackathon_events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "app"."hackathon_judge_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"hackathon_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"judge_user_id" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."hackathon_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"hackathon_id" text NOT NULL,
	"user_id" text NOT NULL,
	"selected_tracks" text[] DEFAULT '{}' NOT NULL,
	"looking_for_team" boolean DEFAULT false NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."hackathon_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"judge_user_id" text NOT NULL,
	"hackathon_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"score" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."hackathon_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"hackathon_id" text NOT NULL,
	"team_id" text NOT NULL,
	"hackathon_submission_status" "app"."hackathon_submission_status" DEFAULT 'draft' NOT NULL,
	"project_title" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"repo_url" text,
	"demo_url" text,
	"video_url" text,
	"figma_url" text,
	"tech_stack" text[] DEFAULT '{}' NOT NULL,
	"selected_tracks" text[] DEFAULT '{}' NOT NULL,
	"cover_image_key" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."hackathon_team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"hackathon_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "app"."team_member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."hackathon_teams" (
	"id" text PRIMARY KEY NOT NULL,
	"hackathon_id" text NOT NULL,
	"name" text NOT NULL,
	"join_code" text NOT NULL,
	"leader_id" text NOT NULL,
	"selected_tracks" text[] DEFAULT '{}' NOT NULL,
	"tech_stack" text[] DEFAULT '{}' NOT NULL,
	"looking_for_members" boolean DEFAULT true NOT NULL,
	"recruitment_pitch" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."hackathon_announcements" ADD CONSTRAINT "hackathon_announcements_hackathon_id_hackathon_events_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "app"."hackathon_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_announcements" ADD CONSTRAINT "hackathon_announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_community_votes" ADD CONSTRAINT "hackathon_community_votes_submission_id_hackathon_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "app"."hackathon_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_community_votes" ADD CONSTRAINT "hackathon_community_votes_hackathon_id_hackathon_events_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "app"."hackathon_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_community_votes" ADD CONSTRAINT "hackathon_community_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_events" ADD CONSTRAINT "hackathon_events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_judge_assignments" ADD CONSTRAINT "hackathon_judge_assignments_hackathon_id_hackathon_events_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "app"."hackathon_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_judge_assignments" ADD CONSTRAINT "hackathon_judge_assignments_submission_id_hackathon_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "app"."hackathon_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_judge_assignments" ADD CONSTRAINT "hackathon_judge_assignments_judge_user_id_users_id_fk" FOREIGN KEY ("judge_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_registrations" ADD CONSTRAINT "hackathon_registrations_hackathon_id_hackathon_events_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "app"."hackathon_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_registrations" ADD CONSTRAINT "hackathon_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_scores" ADD CONSTRAINT "hackathon_scores_submission_id_hackathon_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "app"."hackathon_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_scores" ADD CONSTRAINT "hackathon_scores_judge_user_id_users_id_fk" FOREIGN KEY ("judge_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_scores" ADD CONSTRAINT "hackathon_scores_hackathon_id_hackathon_events_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "app"."hackathon_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_submissions" ADD CONSTRAINT "hackathon_submissions_hackathon_id_hackathon_events_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "app"."hackathon_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_submissions" ADD CONSTRAINT "hackathon_submissions_team_id_hackathon_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "app"."hackathon_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_team_members" ADD CONSTRAINT "hackathon_team_members_team_id_hackathon_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "app"."hackathon_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_team_members" ADD CONSTRAINT "hackathon_team_members_hackathon_id_hackathon_events_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "app"."hackathon_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_team_members" ADD CONSTRAINT "hackathon_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_teams" ADD CONSTRAINT "hackathon_teams_hackathon_id_hackathon_events_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "app"."hackathon_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."hackathon_teams" ADD CONSTRAINT "hackathon_teams_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hackathon_announcements_hackathon_idx" ON "app"."hackathon_announcements" USING btree ("hackathon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hackathon_community_votes_submission_user_idx" ON "app"."hackathon_community_votes" USING btree ("submission_id","user_id");--> statement-breakpoint
CREATE INDEX "hackathon_community_votes_submission_idx" ON "app"."hackathon_community_votes" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "hackathon_events_status_idx" ON "app"."hackathon_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hackathon_events_program_idx" ON "app"."hackathon_events" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hackathon_judge_assignments_judge_submission_idx" ON "app"."hackathon_judge_assignments" USING btree ("submission_id","judge_user_id");--> statement-breakpoint
CREATE INDEX "hackathon_judge_assignments_hackathon_idx" ON "app"."hackathon_judge_assignments" USING btree ("hackathon_id");--> statement-breakpoint
CREATE INDEX "hackathon_judge_assignments_judge_idx" ON "app"."hackathon_judge_assignments" USING btree ("judge_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hackathon_registrations_user_hackathon_idx" ON "app"."hackathon_registrations" USING btree ("hackathon_id","user_id");--> statement-breakpoint
CREATE INDEX "hackathon_registrations_hackathon_idx" ON "app"."hackathon_registrations" USING btree ("hackathon_id");--> statement-breakpoint
CREATE INDEX "hackathon_registrations_looking_idx" ON "app"."hackathon_registrations" USING btree ("hackathon_id","looking_for_team");--> statement-breakpoint
CREATE UNIQUE INDEX "hackathon_scores_submission_judge_criterion_idx" ON "app"."hackathon_scores" USING btree ("submission_id","judge_user_id","criterion_id");--> statement-breakpoint
CREATE INDEX "hackathon_scores_submission_idx" ON "app"."hackathon_scores" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "hackathon_scores_judge_hackathon_idx" ON "app"."hackathon_scores" USING btree ("judge_user_id","hackathon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hackathon_submissions_team_hackathon_idx" ON "app"."hackathon_submissions" USING btree ("hackathon_id","team_id");--> statement-breakpoint
CREATE INDEX "hackathon_submissions_hackathon_status_idx" ON "app"."hackathon_submissions" USING btree ("hackathon_id","hackathon_submission_status");--> statement-breakpoint
CREATE INDEX "hackathon_submissions_hackathon_idx" ON "app"."hackathon_submissions" USING btree ("hackathon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hackathon_team_members_user_hackathon_idx" ON "app"."hackathon_team_members" USING btree ("hackathon_id","user_id");--> statement-breakpoint
CREATE INDEX "hackathon_team_members_team_idx" ON "app"."hackathon_team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "hackathon_teams_hackathon_idx" ON "app"."hackathon_teams" USING btree ("hackathon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hackathon_teams_join_code_hackathon_idx" ON "app"."hackathon_teams" USING btree ("hackathon_id","join_code");