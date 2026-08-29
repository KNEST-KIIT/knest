CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."journey_stage" AS ENUM('exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established');--> statement-breakpoint
CREATE TYPE "app"."platform_role" AS ENUM('student', 'founder', 'mentor', 'investor', 'alumni', 'partner', 'other');--> statement-breakpoint
CREATE TYPE "app"."profile_visibility" AS ENUM('public', 'community', 'private');--> statement-breakpoint
CREATE TYPE "app"."staff_role" AS ENUM('reviewer', 'content_admin', 'program_manager', 'startup_manager', 'mentor_manager', 'super_admin');--> statement-breakpoint
CREATE TABLE "app"."accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "app"."sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"password_hash" text,
	"name" text,
	"image" text,
	"platform_role" "app"."platform_role" DEFAULT 'student' NOT NULL,
	"staff_role" "app"."staff_role",
	"bio" text,
	"organization" text,
	"school" text,
	"graduation_year" integer,
	"linkedin_url" text,
	"website_url" text,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"profile_visibility" "app"."profile_visibility" DEFAULT 'community' NOT NULL,
	"journey_stage" "app"."journey_stage",
	"onboarding_completed_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "app"."verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "app"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "app"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "app"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_staff_role_idx" ON "app"."users" USING btree ("staff_role");--> statement-breakpoint
CREATE INDEX "users_platform_role_idx" ON "app"."users" USING btree ("platform_role");