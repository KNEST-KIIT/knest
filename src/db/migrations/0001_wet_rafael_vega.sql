CREATE TYPE "app"."mentor_availability" AS ENUM('open', 'limited', 'unavailable');--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "goals" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "expertise_areas" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "years_of_experience" integer;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "mentor_availability" "app"."mentor_availability";