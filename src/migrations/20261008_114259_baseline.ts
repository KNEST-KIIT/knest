import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Hand-added to the generated file: Payload's generated SQL assumes the schema
  // exists (dev-mode push used to create it), so a migrate on an empty database
  // failed with: schema "cms" does not exist.
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "cms"`)
  await db.execute(sql`
   CREATE TYPE "cms"."enum_programs_stage" AS ENUM('exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established');
  CREATE TYPE "cms"."enum_programs_sectors" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum_programs_audience" AS ENUM('students', 'aspiring_founders', 'founders', 'researchers', 'alumni');
  CREATE TYPE "cms"."enum_programs_application_questions_field_type" AS ENUM('text', 'textarea', 'select', 'multiselect', 'url', 'file');
  CREATE TYPE "cms"."enum_programs_format" AS ENUM('in_person', 'hybrid', 'online');
  CREATE TYPE "cms"."enum_programs_application_status" AS ENUM('open', 'opening_soon', 'closed', 'in_progress');
  CREATE TYPE "cms"."enum_programs_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__programs_v_version_stage" AS ENUM('exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established');
  CREATE TYPE "cms"."enum__programs_v_version_sectors" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum__programs_v_version_audience" AS ENUM('students', 'aspiring_founders', 'founders', 'researchers', 'alumni');
  CREATE TYPE "cms"."enum__programs_v_version_application_questions_field_type" AS ENUM('text', 'textarea', 'select', 'multiselect', 'url', 'file');
  CREATE TYPE "cms"."enum__programs_v_version_format" AS ENUM('in_person', 'hybrid', 'online');
  CREATE TYPE "cms"."enum__programs_v_version_application_status" AS ENUM('open', 'opening_soon', 'closed', 'in_progress');
  CREATE TYPE "cms"."enum__programs_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_cohorts_status" AS ENUM('upcoming', 'in_progress', 'completed');
  CREATE TYPE "cms"."enum_startups_story_stage" AS ENUM('problem', 'idea', 'experiment', 'product', 'progress');
  CREATE TYPE "cms"."enum_startups_sectors" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum_startups_stage" AS ENUM('exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established');
  CREATE TYPE "cms"."enum_startups_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__startups_v_version_story_stage" AS ENUM('problem', 'idea', 'experiment', 'product', 'progress');
  CREATE TYPE "cms"."enum__startups_v_version_sectors" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum__startups_v_version_stage" AS ENUM('exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established');
  CREATE TYPE "cms"."enum__startups_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_founders_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__founders_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_mentors_expertise" AS ENUM('product', 'fundraising', 'gtm', 'technology', 'legal', 'hiring', 'industry', 'design', 'operations');
  CREATE TYPE "cms"."enum_mentors_sectors" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum_mentors_availability" AS ENUM('open', 'limited', 'unavailable');
  CREATE TYPE "cms"."enum_mentors_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__mentors_v_version_expertise" AS ENUM('product', 'fundraising', 'gtm', 'technology', 'legal', 'hiring', 'industry', 'design', 'operations');
  CREATE TYPE "cms"."enum__mentors_v_version_sectors" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum__mentors_v_version_availability" AS ENUM('open', 'limited', 'unavailable');
  CREATE TYPE "cms"."enum__mentors_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_partners_type" AS ENUM('industry', 'academic', 'government', 'investor', 'community');
  CREATE TYPE "cms"."enum_partners_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__partners_v_version_type" AS ENUM('industry', 'academic', 'government', 'investor', 'community');
  CREATE TYPE "cms"."enum__partners_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_events_relevant_stages" AS ENUM('exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established');
  CREATE TYPE "cms"."enum_events_sectors" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum_events_event_type" AS ENUM('workshop', 'talk', 'ideation', 'demo_day', 'networking', 'hackathon', 'office_hours');
  CREATE TYPE "cms"."enum_events_format" AS ENUM('in_person', 'hybrid', 'online');
  CREATE TYPE "cms"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__events_v_version_relevant_stages" AS ENUM('exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established');
  CREATE TYPE "cms"."enum__events_v_version_sectors" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum__events_v_version_event_type" AS ENUM('workshop', 'talk', 'ideation', 'demo_day', 'networking', 'hackathon', 'office_hours');
  CREATE TYPE "cms"."enum__events_v_version_format" AS ENUM('in_person', 'hybrid', 'online');
  CREATE TYPE "cms"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_resources_stages" AS ENUM('exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established');
  CREATE TYPE "cms"."enum_resources_topics" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum_resources_format" AS ENUM('guide', 'template', 'playbook', 'video', 'article', 'worksheet');
  CREATE TYPE "cms"."enum_resources_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__resources_v_version_stages" AS ENUM('exploring', 'idea', 'validation', 'mvp', 'early_revenue', 'scaling', 'established');
  CREATE TYPE "cms"."enum__resources_v_version_topics" AS ENUM('ai', 'fintech', 'health', 'climate', 'deeptech', 'saas', 'consumer', 'education', 'hardware', 'agriculture', 'mobility', 'space', 'social_impact', 'media', 'gaming');
  CREATE TYPE "cms"."enum__resources_v_version_format" AS ENUM('guide', 'template', 'playbook', 'video', 'article', 'worksheet');
  CREATE TYPE "cms"."enum__resources_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_articles_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__articles_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_infrastructure_space_type" AS ENUM('coworking', 'startup_studio', 'collaboration_zone', 'maker_lab', 'digital_studio', 'founder_cabin', 'pre_incubation_space', 'event_space', 'meeting_room');
  CREATE TYPE "cms"."enum_infrastructure_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__infrastructure_v_version_space_type" AS ENUM('coworking', 'startup_studio', 'collaboration_zone', 'maker_lab', 'digital_studio', 'founder_cabin', 'pre_incubation_space', 'event_space', 'meeting_room');
  CREATE TYPE "cms"."enum__infrastructure_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum_lab_bookings_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "cms"."enum_faqs_category" AS ENUM('general', 'programs', 'applications', 'eligibility', 'mentorship');
  CREATE TYPE "cms"."enum_homepage_sections_key" AS ENUM('hero', 'problem', 'person', 'knest', 'journey_selector', 'journey', 'offer', 'ecosystem', 'startups', 'closing');
  CREATE TABLE "cms"."programs_timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"description" varchar,
  	"duration" varchar
  );
  
  CREATE TABLE "cms"."programs_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb
  );
  
  CREATE TABLE "cms"."programs_stage" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_programs_stage",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."programs_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_programs_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."programs_audience" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_programs_audience",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."programs_application_questions_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "cms"."programs_application_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"help_text" varchar,
  	"field_type" "cms"."enum_programs_application_questions_field_type" DEFAULT 'text',
  	"required" boolean DEFAULT true,
  	"max_length" numeric
  );
  
  CREATE TABLE "cms"."programs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"tagline" varchar,
  	"who_its_for" jsonb,
  	"what_youll_build" jsonb,
  	"what_youll_get" jsonb,
  	"requirements" jsonb,
  	"format" "cms"."enum_programs_format" DEFAULT 'in_person',
  	"duration" varchar,
  	"cohort_size" numeric,
  	"next_cohort_start" timestamp(3) with time zone,
  	"application_status" "cms"."enum_programs_application_status" DEFAULT 'closed',
  	"application_deadline" timestamp(3) with time zone,
  	"application_opens_at" timestamp(3) with time zone,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"hero_image_id" integer,
  	"featured" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_programs_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."programs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"mentors_id" integer,
  	"partners_id" integer
  );
  
  CREATE TABLE "cms"."_programs_v_version_timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"description" varchar,
  	"duration" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_programs_v_version_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_programs_v_version_stage" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__programs_v_version_stage",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_programs_v_version_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__programs_v_version_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_programs_v_version_audience" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__programs_v_version_audience",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_programs_v_version_application_questions_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_programs_v_version_application_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"help_text" varchar,
  	"field_type" "cms"."enum__programs_v_version_application_questions_field_type" DEFAULT 'text',
  	"required" boolean DEFAULT true,
  	"max_length" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_programs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_tagline" varchar,
  	"version_who_its_for" jsonb,
  	"version_what_youll_build" jsonb,
  	"version_what_youll_get" jsonb,
  	"version_requirements" jsonb,
  	"version_format" "cms"."enum__programs_v_version_format" DEFAULT 'in_person',
  	"version_duration" varchar,
  	"version_cohort_size" numeric,
  	"version_next_cohort_start" timestamp(3) with time zone,
  	"version_application_status" "cms"."enum__programs_v_version_application_status" DEFAULT 'closed',
  	"version_application_deadline" timestamp(3) with time zone,
  	"version_application_opens_at" timestamp(3) with time zone,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_hero_image_id" integer,
  	"version_featured" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__programs_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_programs_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"mentors_id" integer,
  	"partners_id" integer
  );
  
  CREATE TABLE "cms"."cohorts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"program_id" integer NOT NULL,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"status" "cms"."enum_cohorts_status" DEFAULT 'upcoming',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."cohorts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"mentors_id" integer
  );
  
  CREATE TABLE "cms"."startups_story" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"stage" "cms"."enum_startups_story_stage",
  	"heading" varchar,
  	"body" jsonb
  );
  
  CREATE TABLE "cms"."startups_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_startups_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."startups_achievements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."startups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"tagline" varchar,
  	"stage" "cms"."enum_startups_stage",
  	"cohort_id" integer,
  	"school" varchar,
  	"founded_year" numeric,
  	"website_url" varchar,
  	"logo_id" integer,
  	"cover_image_id" integer,
  	"featured" boolean DEFAULT false,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_startups_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."startups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"founders_id" integer
  );
  
  CREATE TABLE "cms"."_startups_v_version_story" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"stage" "cms"."enum__startups_v_version_story_stage",
  	"heading" varchar,
  	"body" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_startups_v_version_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__startups_v_version_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_startups_v_version_achievements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"date" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_startups_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_tagline" varchar,
  	"version_stage" "cms"."enum__startups_v_version_stage",
  	"version_cohort_id" integer,
  	"version_school" varchar,
  	"version_founded_year" numeric,
  	"version_website_url" varchar,
  	"version_logo_id" integer,
  	"version_cover_image_id" integer,
  	"version_featured" boolean DEFAULT false,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__startups_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_startups_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"founders_id" integer
  );
  
  CREATE TABLE "cms"."founders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"headline" varchar,
  	"bio" varchar,
  	"school" varchar,
  	"graduation_year" numeric,
  	"linkedin_url" varchar,
  	"photo_id" integer,
  	"user_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_founders_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_founders_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_headline" varchar,
  	"version_bio" varchar,
  	"version_school" varchar,
  	"version_graduation_year" numeric,
  	"version_linkedin_url" varchar,
  	"version_photo_id" integer,
  	"version_user_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__founders_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."mentors_expertise" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_mentors_expertise",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."mentors_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_mentors_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."mentors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"title" varchar,
  	"organization" varchar,
  	"bio" varchar,
  	"availability" "cms"."enum_mentors_availability" DEFAULT 'limited',
  	"linkedin_url" varchar,
  	"photo_id" integer,
  	"featured" boolean DEFAULT false,
  	"user_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_mentors_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_mentors_v_version_expertise" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__mentors_v_version_expertise",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_mentors_v_version_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__mentors_v_version_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_mentors_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_title" varchar,
  	"version_organization" varchar,
  	"version_bio" varchar,
  	"version_availability" "cms"."enum__mentors_v_version_availability" DEFAULT 'limited',
  	"version_linkedin_url" varchar,
  	"version_photo_id" integer,
  	"version_featured" boolean DEFAULT false,
  	"version_user_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__mentors_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."partners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"type" "cms"."enum_partners_type",
  	"description" varchar,
  	"website_url" varchar,
  	"logo_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_partners_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_partners_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_type" "cms"."enum__partners_v_version_type",
  	"version_description" varchar,
  	"version_website_url" varchar,
  	"version_logo_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__partners_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."events_speakers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"title" varchar,
  	"organization" varchar,
  	"photo_id" integer
  );
  
  CREATE TABLE "cms"."events_relevant_stages" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_events_relevant_stages",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."events_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_events_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"summary" varchar,
  	"description" jsonb,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"event_type" "cms"."enum_events_event_type" DEFAULT 'workshop',
  	"format" "cms"."enum_events_format" DEFAULT 'in_person',
  	"location" varchar,
  	"registration_url" varchar,
  	"capacity" numeric,
  	"program_id" integer,
  	"cohort_id" integer,
  	"hero_image_id" integer,
  	"featured" boolean DEFAULT false,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_events_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."events_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"mentors_id" integer
  );
  
  CREATE TABLE "cms"."_events_v_version_speakers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"title" varchar,
  	"organization" varchar,
  	"photo_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_events_v_version_relevant_stages" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__events_v_version_relevant_stages",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_events_v_version_sectors" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__events_v_version_sectors",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_summary" varchar,
  	"version_description" jsonb,
  	"version_starts_at" timestamp(3) with time zone,
  	"version_ends_at" timestamp(3) with time zone,
  	"version_event_type" "cms"."enum__events_v_version_event_type" DEFAULT 'workshop',
  	"version_format" "cms"."enum__events_v_version_format" DEFAULT 'in_person',
  	"version_location" varchar,
  	"version_registration_url" varchar,
  	"version_capacity" numeric,
  	"version_program_id" integer,
  	"version_cohort_id" integer,
  	"version_hero_image_id" integer,
  	"version_featured" boolean DEFAULT false,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__events_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_events_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"mentors_id" integer
  );
  
  CREATE TABLE "cms"."resources_stages" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_resources_stages",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."resources_topics" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum_resources_topics",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."resources" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"summary" varchar,
  	"format" "cms"."enum_resources_format" DEFAULT 'guide',
  	"body" jsonb,
  	"external_url" varchar,
  	"file_id" integer,
  	"reading_minutes" numeric,
  	"featured" boolean DEFAULT false,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_resources_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_resources_v_version_stages" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__resources_v_version_stages",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_resources_v_version_topics" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "cms"."enum__resources_v_version_topics",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cms"."_resources_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_summary" varchar,
  	"version_format" "cms"."enum__resources_v_version_format" DEFAULT 'guide',
  	"version_body" jsonb,
  	"version_external_url" varchar,
  	"version_file_id" integer,
  	"version_reading_minutes" numeric,
  	"version_featured" boolean DEFAULT false,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__resources_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"published_at" timestamp(3) with time zone,
  	"author" varchar,
  	"startup_id" integer,
  	"hero_image_id" integer,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_articles_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."_articles_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"version_published_at" timestamp(3) with time zone,
  	"version_author" varchar,
  	"version_startup_id" integer,
  	"version_hero_image_id" integer,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__articles_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."infrastructure_equipment" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar
  );
  
  CREATE TABLE "cms"."infrastructure" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"summary" varchar,
  	"description" jsonb,
  	"space_type" "cms"."enum_infrastructure_space_type",
  	"location" varchar,
  	"capacity" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_infrastructure_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."infrastructure_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "cms"."_infrastructure_v_version_equipment" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"item" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_infrastructure_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_summary" varchar,
  	"version_description" jsonb,
  	"version_space_type" "cms"."enum__infrastructure_v_version_space_type",
  	"version_location" varchar,
  	"version_capacity" numeric,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__infrastructure_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "cms"."_infrastructure_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
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
  
  CREATE TABLE "cms"."testimonials" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"quote" varchar NOT NULL,
  	"attribution" varchar NOT NULL,
  	"role" varchar,
  	"photo_id" integer,
  	"startup_id" integer,
  	"program_id" integer,
  	"consent_given" boolean DEFAULT false NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."faqs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" jsonb NOT NULL,
  	"category" "cms"."enum_faqs_category" DEFAULT 'general',
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."metrics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL,
  	"as_of" timestamp(3) with time zone NOT NULL,
  	"source" varchar NOT NULL,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"credit" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "cms"."staff" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"staff_role" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"programs_id" integer,
  	"cohorts_id" integer,
  	"startups_id" integer,
  	"founders_id" integer,
  	"mentors_id" integer,
  	"partners_id" integer,
  	"events_id" integer,
  	"resources_id" integer,
  	"articles_id" integer,
  	"infrastructure_id" integer,
  	"lab_bookings_id" integer,
  	"testimonials_id" integer,
  	"faqs_id" integer,
  	"metrics_id" integer,
  	"media_id" integer,
  	"staff_id" varchar
  );
  
  CREATE TABLE "cms"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"staff_id" varchar
  );
  
  CREATE TABLE "cms"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."homepage_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" "cms"."enum_homepage_sections_key" NOT NULL,
  	"enabled" boolean DEFAULT true
  );
  
  CREATE TABLE "cms"."homepage_person_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"line" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."homepage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_headline" varchar DEFAULT 'WHAT IF YOU
  ACTUALLY BUILT IT?' NOT NULL,
  	"hero_subhead" varchar DEFAULT 'Most ideas stay ideas. Not because they were bad — because nobody ever took the next step.' NOT NULL,
  	"hero_primary_cta" varchar DEFAULT 'Start your journey' NOT NULL,
  	"hero_secondary_cta" varchar DEFAULT 'Explore programs',
  	"hero_media_id" integer,
  	"problem_heading" varchar DEFAULT 'THE HARDEST PART ISN''T THE IDEA.',
  	"problem_body" varchar,
  	"person_heading" varchar DEFAULT 'YOU DON’T HAVE TO BE "AN ENTREPRENEUR" YET.',
  	"knest_heading" varchar DEFAULT 'KNEST IS WHERE YOU FIND OUT WHAT HAPPENS NEXT.',
  	"knest_body" varchar,
  	"closing_heading" varchar DEFAULT 'THERE IS SOMETHING YOU COULD BUILD.',
  	"closing_body" varchar DEFAULT 'Let''s find out what it is.',
  	"closing_cta" varchar DEFAULT 'Start your journey',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."homepage_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"programs_id" integer,
  	"startups_id" integer,
  	"events_id" integer,
  	"testimonials_id" integer,
  	"metrics_id" integer
  );
  
  ALTER TABLE "cms"."programs_timeline" ADD CONSTRAINT "programs_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."programs_faqs" ADD CONSTRAINT "programs_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."programs_stage" ADD CONSTRAINT "programs_stage_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."programs_sectors" ADD CONSTRAINT "programs_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."programs_audience" ADD CONSTRAINT "programs_audience_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."programs_application_questions_options" ADD CONSTRAINT "programs_application_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."programs_application_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."programs_application_questions" ADD CONSTRAINT "programs_application_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."programs" ADD CONSTRAINT "programs_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."programs" ADD CONSTRAINT "programs_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."programs_rels" ADD CONSTRAINT "programs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."programs_rels" ADD CONSTRAINT "programs_rels_mentors_fk" FOREIGN KEY ("mentors_id") REFERENCES "cms"."mentors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."programs_rels" ADD CONSTRAINT "programs_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "cms"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_version_timeline" ADD CONSTRAINT "_programs_v_version_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_version_faqs" ADD CONSTRAINT "_programs_v_version_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_version_stage" ADD CONSTRAINT "_programs_v_version_stage_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_version_sectors" ADD CONSTRAINT "_programs_v_version_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_version_audience" ADD CONSTRAINT "_programs_v_version_audience_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_version_application_questions_options" ADD CONSTRAINT "_programs_v_version_application_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_programs_v_version_application_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_version_application_questions" ADD CONSTRAINT "_programs_v_version_application_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v" ADD CONSTRAINT "_programs_v_parent_id_programs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v" ADD CONSTRAINT "_programs_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v" ADD CONSTRAINT "_programs_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_programs_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_mentors_fk" FOREIGN KEY ("mentors_id") REFERENCES "cms"."mentors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_programs_v_rels" ADD CONSTRAINT "_programs_v_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "cms"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."cohorts" ADD CONSTRAINT "cohorts_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "cms"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."cohorts_rels" ADD CONSTRAINT "cohorts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."cohorts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."cohorts_rels" ADD CONSTRAINT "cohorts_rels_mentors_fk" FOREIGN KEY ("mentors_id") REFERENCES "cms"."mentors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."startups_story" ADD CONSTRAINT "startups_story_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."startups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."startups_sectors" ADD CONSTRAINT "startups_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."startups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."startups_achievements" ADD CONSTRAINT "startups_achievements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."startups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."startups" ADD CONSTRAINT "startups_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "cms"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."startups" ADD CONSTRAINT "startups_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."startups" ADD CONSTRAINT "startups_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."startups" ADD CONSTRAINT "startups_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."startups_rels" ADD CONSTRAINT "startups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."startups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."startups_rels" ADD CONSTRAINT "startups_rels_founders_fk" FOREIGN KEY ("founders_id") REFERENCES "cms"."founders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v_version_story" ADD CONSTRAINT "_startups_v_version_story_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_startups_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v_version_sectors" ADD CONSTRAINT "_startups_v_version_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_startups_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v_version_achievements" ADD CONSTRAINT "_startups_v_version_achievements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_startups_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v" ADD CONSTRAINT "_startups_v_parent_id_startups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."startups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v" ADD CONSTRAINT "_startups_v_version_cohort_id_cohorts_id_fk" FOREIGN KEY ("version_cohort_id") REFERENCES "cms"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v" ADD CONSTRAINT "_startups_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v" ADD CONSTRAINT "_startups_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v" ADD CONSTRAINT "_startups_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v_rels" ADD CONSTRAINT "_startups_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_startups_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_startups_v_rels" ADD CONSTRAINT "_startups_v_rels_founders_fk" FOREIGN KEY ("founders_id") REFERENCES "cms"."founders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."founders" ADD CONSTRAINT "founders_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_founders_v" ADD CONSTRAINT "_founders_v_parent_id_founders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."founders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_founders_v" ADD CONSTRAINT "_founders_v_version_photo_id_media_id_fk" FOREIGN KEY ("version_photo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."mentors_expertise" ADD CONSTRAINT "mentors_expertise_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."mentors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."mentors_sectors" ADD CONSTRAINT "mentors_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."mentors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."mentors" ADD CONSTRAINT "mentors_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_mentors_v_version_expertise" ADD CONSTRAINT "_mentors_v_version_expertise_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_mentors_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_mentors_v_version_sectors" ADD CONSTRAINT "_mentors_v_version_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_mentors_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_mentors_v" ADD CONSTRAINT "_mentors_v_parent_id_mentors_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."mentors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_mentors_v" ADD CONSTRAINT "_mentors_v_version_photo_id_media_id_fk" FOREIGN KEY ("version_photo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."partners" ADD CONSTRAINT "partners_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_partners_v" ADD CONSTRAINT "_partners_v_parent_id_partners_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_partners_v" ADD CONSTRAINT "_partners_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events_speakers" ADD CONSTRAINT "events_speakers_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events_speakers" ADD CONSTRAINT "events_speakers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."events_relevant_stages" ADD CONSTRAINT "events_relevant_stages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."events_sectors" ADD CONSTRAINT "events_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "cms"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "cms"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events" ADD CONSTRAINT "events_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."events_rels" ADD CONSTRAINT "events_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."events_rels" ADD CONSTRAINT "events_rels_mentors_fk" FOREIGN KEY ("mentors_id") REFERENCES "cms"."mentors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_events_v_version_speakers" ADD CONSTRAINT "_events_v_version_speakers_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v_version_speakers" ADD CONSTRAINT "_events_v_version_speakers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_events_v_version_relevant_stages" ADD CONSTRAINT "_events_v_version_relevant_stages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_events_v_version_sectors" ADD CONSTRAINT "_events_v_version_sectors_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_program_id_programs_id_fk" FOREIGN KEY ("version_program_id") REFERENCES "cms"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_cohort_id_cohorts_id_fk" FOREIGN KEY ("version_cohort_id") REFERENCES "cms"."cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v" ADD CONSTRAINT "_events_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_events_v_rels" ADD CONSTRAINT "_events_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_events_v_rels" ADD CONSTRAINT "_events_v_rels_mentors_fk" FOREIGN KEY ("mentors_id") REFERENCES "cms"."mentors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."resources_stages" ADD CONSTRAINT "resources_stages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."resources_topics" ADD CONSTRAINT "resources_topics_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."resources" ADD CONSTRAINT "resources_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."resources" ADD CONSTRAINT "resources_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_resources_v_version_stages" ADD CONSTRAINT "_resources_v_version_stages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_resources_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_resources_v_version_topics" ADD CONSTRAINT "_resources_v_version_topics_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_resources_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_resources_v" ADD CONSTRAINT "_resources_v_parent_id_resources_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."resources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_resources_v" ADD CONSTRAINT "_resources_v_version_file_id_media_id_fk" FOREIGN KEY ("version_file_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_resources_v" ADD CONSTRAINT "_resources_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."articles" ADD CONSTRAINT "articles_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "cms"."startups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."articles" ADD CONSTRAINT "articles_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."articles" ADD CONSTRAINT "articles_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_version_startup_id_startups_id_fk" FOREIGN KEY ("version_startup_id") REFERENCES "cms"."startups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_articles_v" ADD CONSTRAINT "_articles_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."infrastructure_equipment" ADD CONSTRAINT "infrastructure_equipment_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."infrastructure"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."infrastructure_rels" ADD CONSTRAINT "infrastructure_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."infrastructure"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."infrastructure_rels" ADD CONSTRAINT "infrastructure_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_infrastructure_v_version_equipment" ADD CONSTRAINT "_infrastructure_v_version_equipment_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_infrastructure_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_infrastructure_v" ADD CONSTRAINT "_infrastructure_v_parent_id_infrastructure_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."infrastructure"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_infrastructure_v_rels" ADD CONSTRAINT "_infrastructure_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_infrastructure_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_infrastructure_v_rels" ADD CONSTRAINT "_infrastructure_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."lab_bookings" ADD CONSTRAINT "lab_bookings_infrastructure_id_infrastructure_id_fk" FOREIGN KEY ("infrastructure_id") REFERENCES "cms"."infrastructure"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."testimonials" ADD CONSTRAINT "testimonials_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."testimonials" ADD CONSTRAINT "testimonials_startup_id_startups_id_fk" FOREIGN KEY ("startup_id") REFERENCES "cms"."startups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."testimonials" ADD CONSTRAINT "testimonials_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "cms"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "cms"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cohorts_fk" FOREIGN KEY ("cohorts_id") REFERENCES "cms"."cohorts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_startups_fk" FOREIGN KEY ("startups_id") REFERENCES "cms"."startups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_founders_fk" FOREIGN KEY ("founders_id") REFERENCES "cms"."founders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mentors_fk" FOREIGN KEY ("mentors_id") REFERENCES "cms"."mentors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "cms"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_resources_fk" FOREIGN KEY ("resources_id") REFERENCES "cms"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "cms"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_infrastructure_fk" FOREIGN KEY ("infrastructure_id") REFERENCES "cms"."infrastructure"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lab_bookings_fk" FOREIGN KEY ("lab_bookings_id") REFERENCES "cms"."lab_bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_testimonials_fk" FOREIGN KEY ("testimonials_id") REFERENCES "cms"."testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_faqs_fk" FOREIGN KEY ("faqs_id") REFERENCES "cms"."faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_metrics_fk" FOREIGN KEY ("metrics_id") REFERENCES "cms"."metrics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "cms"."staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "cms"."staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."homepage_sections" ADD CONSTRAINT "homepage_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."homepage_person_lines" ADD CONSTRAINT "homepage_person_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."homepage" ADD CONSTRAINT "homepage_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."homepage_rels" ADD CONSTRAINT "homepage_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."homepage_rels" ADD CONSTRAINT "homepage_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "cms"."programs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."homepage_rels" ADD CONSTRAINT "homepage_rels_startups_fk" FOREIGN KEY ("startups_id") REFERENCES "cms"."startups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."homepage_rels" ADD CONSTRAINT "homepage_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."homepage_rels" ADD CONSTRAINT "homepage_rels_testimonials_fk" FOREIGN KEY ("testimonials_id") REFERENCES "cms"."testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."homepage_rels" ADD CONSTRAINT "homepage_rels_metrics_fk" FOREIGN KEY ("metrics_id") REFERENCES "cms"."metrics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "programs_timeline_order_idx" ON "cms"."programs_timeline" USING btree ("_order");
  CREATE INDEX "programs_timeline_parent_id_idx" ON "cms"."programs_timeline" USING btree ("_parent_id");
  CREATE INDEX "programs_faqs_order_idx" ON "cms"."programs_faqs" USING btree ("_order");
  CREATE INDEX "programs_faqs_parent_id_idx" ON "cms"."programs_faqs" USING btree ("_parent_id");
  CREATE INDEX "programs_stage_order_idx" ON "cms"."programs_stage" USING btree ("order");
  CREATE INDEX "programs_stage_parent_idx" ON "cms"."programs_stage" USING btree ("parent_id");
  CREATE INDEX "programs_stage_value_idx" ON "cms"."programs_stage" USING btree ("value");
  CREATE INDEX "programs_sectors_order_idx" ON "cms"."programs_sectors" USING btree ("order");
  CREATE INDEX "programs_sectors_parent_idx" ON "cms"."programs_sectors" USING btree ("parent_id");
  CREATE INDEX "programs_sectors_value_idx" ON "cms"."programs_sectors" USING btree ("value");
  CREATE INDEX "programs_audience_order_idx" ON "cms"."programs_audience" USING btree ("order");
  CREATE INDEX "programs_audience_parent_idx" ON "cms"."programs_audience" USING btree ("parent_id");
  CREATE INDEX "programs_application_questions_options_order_idx" ON "cms"."programs_application_questions_options" USING btree ("_order");
  CREATE INDEX "programs_application_questions_options_parent_id_idx" ON "cms"."programs_application_questions_options" USING btree ("_parent_id");
  CREATE INDEX "programs_application_questions_order_idx" ON "cms"."programs_application_questions" USING btree ("_order");
  CREATE INDEX "programs_application_questions_parent_id_idx" ON "cms"."programs_application_questions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "programs_slug_idx" ON "cms"."programs" USING btree ("slug");
  CREATE INDEX "programs_application_status_idx" ON "cms"."programs" USING btree ("application_status");
  CREATE INDEX "programs_seo_seo_image_idx" ON "cms"."programs" USING btree ("seo_image_id");
  CREATE INDEX "programs_hero_image_idx" ON "cms"."programs" USING btree ("hero_image_id");
  CREATE INDEX "programs_updated_at_idx" ON "cms"."programs" USING btree ("updated_at");
  CREATE INDEX "programs_created_at_idx" ON "cms"."programs" USING btree ("created_at");
  CREATE INDEX "programs__status_idx" ON "cms"."programs" USING btree ("_status");
  CREATE INDEX "programs_rels_order_idx" ON "cms"."programs_rels" USING btree ("order");
  CREATE INDEX "programs_rels_parent_idx" ON "cms"."programs_rels" USING btree ("parent_id");
  CREATE INDEX "programs_rels_path_idx" ON "cms"."programs_rels" USING btree ("path");
  CREATE INDEX "programs_rels_mentors_id_idx" ON "cms"."programs_rels" USING btree ("mentors_id");
  CREATE INDEX "programs_rels_partners_id_idx" ON "cms"."programs_rels" USING btree ("partners_id");
  CREATE INDEX "_programs_v_version_timeline_order_idx" ON "cms"."_programs_v_version_timeline" USING btree ("_order");
  CREATE INDEX "_programs_v_version_timeline_parent_id_idx" ON "cms"."_programs_v_version_timeline" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_faqs_order_idx" ON "cms"."_programs_v_version_faqs" USING btree ("_order");
  CREATE INDEX "_programs_v_version_faqs_parent_id_idx" ON "cms"."_programs_v_version_faqs" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_stage_order_idx" ON "cms"."_programs_v_version_stage" USING btree ("order");
  CREATE INDEX "_programs_v_version_stage_parent_idx" ON "cms"."_programs_v_version_stage" USING btree ("parent_id");
  CREATE INDEX "_programs_v_version_stage_value_idx" ON "cms"."_programs_v_version_stage" USING btree ("value");
  CREATE INDEX "_programs_v_version_sectors_order_idx" ON "cms"."_programs_v_version_sectors" USING btree ("order");
  CREATE INDEX "_programs_v_version_sectors_parent_idx" ON "cms"."_programs_v_version_sectors" USING btree ("parent_id");
  CREATE INDEX "_programs_v_version_sectors_value_idx" ON "cms"."_programs_v_version_sectors" USING btree ("value");
  CREATE INDEX "_programs_v_version_audience_order_idx" ON "cms"."_programs_v_version_audience" USING btree ("order");
  CREATE INDEX "_programs_v_version_audience_parent_idx" ON "cms"."_programs_v_version_audience" USING btree ("parent_id");
  CREATE INDEX "_programs_v_version_application_questions_options_order_idx" ON "cms"."_programs_v_version_application_questions_options" USING btree ("_order");
  CREATE INDEX "_programs_v_version_application_questions_options_parent_id_idx" ON "cms"."_programs_v_version_application_questions_options" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_version_application_questions_order_idx" ON "cms"."_programs_v_version_application_questions" USING btree ("_order");
  CREATE INDEX "_programs_v_version_application_questions_parent_id_idx" ON "cms"."_programs_v_version_application_questions" USING btree ("_parent_id");
  CREATE INDEX "_programs_v_parent_idx" ON "cms"."_programs_v" USING btree ("parent_id");
  CREATE INDEX "_programs_v_version_version_slug_idx" ON "cms"."_programs_v" USING btree ("version_slug");
  CREATE INDEX "_programs_v_version_version_application_status_idx" ON "cms"."_programs_v" USING btree ("version_application_status");
  CREATE INDEX "_programs_v_version_seo_version_seo_image_idx" ON "cms"."_programs_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_programs_v_version_version_hero_image_idx" ON "cms"."_programs_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_programs_v_version_version_updated_at_idx" ON "cms"."_programs_v" USING btree ("version_updated_at");
  CREATE INDEX "_programs_v_version_version_created_at_idx" ON "cms"."_programs_v" USING btree ("version_created_at");
  CREATE INDEX "_programs_v_version_version__status_idx" ON "cms"."_programs_v" USING btree ("version__status");
  CREATE INDEX "_programs_v_created_at_idx" ON "cms"."_programs_v" USING btree ("created_at");
  CREATE INDEX "_programs_v_updated_at_idx" ON "cms"."_programs_v" USING btree ("updated_at");
  CREATE INDEX "_programs_v_latest_idx" ON "cms"."_programs_v" USING btree ("latest");
  CREATE INDEX "_programs_v_rels_order_idx" ON "cms"."_programs_v_rels" USING btree ("order");
  CREATE INDEX "_programs_v_rels_parent_idx" ON "cms"."_programs_v_rels" USING btree ("parent_id");
  CREATE INDEX "_programs_v_rels_path_idx" ON "cms"."_programs_v_rels" USING btree ("path");
  CREATE INDEX "_programs_v_rels_mentors_id_idx" ON "cms"."_programs_v_rels" USING btree ("mentors_id");
  CREATE INDEX "_programs_v_rels_partners_id_idx" ON "cms"."_programs_v_rels" USING btree ("partners_id");
  CREATE INDEX "cohorts_program_idx" ON "cms"."cohorts" USING btree ("program_id");
  CREATE INDEX "cohorts_updated_at_idx" ON "cms"."cohorts" USING btree ("updated_at");
  CREATE INDEX "cohorts_created_at_idx" ON "cms"."cohorts" USING btree ("created_at");
  CREATE INDEX "cohorts_rels_order_idx" ON "cms"."cohorts_rels" USING btree ("order");
  CREATE INDEX "cohorts_rels_parent_idx" ON "cms"."cohorts_rels" USING btree ("parent_id");
  CREATE INDEX "cohorts_rels_path_idx" ON "cms"."cohorts_rels" USING btree ("path");
  CREATE INDEX "cohorts_rels_mentors_id_idx" ON "cms"."cohorts_rels" USING btree ("mentors_id");
  CREATE INDEX "startups_story_order_idx" ON "cms"."startups_story" USING btree ("_order");
  CREATE INDEX "startups_story_parent_id_idx" ON "cms"."startups_story" USING btree ("_parent_id");
  CREATE INDEX "startups_sectors_order_idx" ON "cms"."startups_sectors" USING btree ("order");
  CREATE INDEX "startups_sectors_parent_idx" ON "cms"."startups_sectors" USING btree ("parent_id");
  CREATE INDEX "startups_sectors_value_idx" ON "cms"."startups_sectors" USING btree ("value");
  CREATE INDEX "startups_achievements_order_idx" ON "cms"."startups_achievements" USING btree ("_order");
  CREATE INDEX "startups_achievements_parent_id_idx" ON "cms"."startups_achievements" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "startups_slug_idx" ON "cms"."startups" USING btree ("slug");
  CREATE INDEX "startups_stage_idx" ON "cms"."startups" USING btree ("stage");
  CREATE INDEX "startups_cohort_idx" ON "cms"."startups" USING btree ("cohort_id");
  CREATE INDEX "startups_logo_idx" ON "cms"."startups" USING btree ("logo_id");
  CREATE INDEX "startups_cover_image_idx" ON "cms"."startups" USING btree ("cover_image_id");
  CREATE INDEX "startups_seo_seo_image_idx" ON "cms"."startups" USING btree ("seo_image_id");
  CREATE INDEX "startups_updated_at_idx" ON "cms"."startups" USING btree ("updated_at");
  CREATE INDEX "startups_created_at_idx" ON "cms"."startups" USING btree ("created_at");
  CREATE INDEX "startups__status_idx" ON "cms"."startups" USING btree ("_status");
  CREATE INDEX "startups_rels_order_idx" ON "cms"."startups_rels" USING btree ("order");
  CREATE INDEX "startups_rels_parent_idx" ON "cms"."startups_rels" USING btree ("parent_id");
  CREATE INDEX "startups_rels_path_idx" ON "cms"."startups_rels" USING btree ("path");
  CREATE INDEX "startups_rels_founders_id_idx" ON "cms"."startups_rels" USING btree ("founders_id");
  CREATE INDEX "_startups_v_version_story_order_idx" ON "cms"."_startups_v_version_story" USING btree ("_order");
  CREATE INDEX "_startups_v_version_story_parent_id_idx" ON "cms"."_startups_v_version_story" USING btree ("_parent_id");
  CREATE INDEX "_startups_v_version_sectors_order_idx" ON "cms"."_startups_v_version_sectors" USING btree ("order");
  CREATE INDEX "_startups_v_version_sectors_parent_idx" ON "cms"."_startups_v_version_sectors" USING btree ("parent_id");
  CREATE INDEX "_startups_v_version_sectors_value_idx" ON "cms"."_startups_v_version_sectors" USING btree ("value");
  CREATE INDEX "_startups_v_version_achievements_order_idx" ON "cms"."_startups_v_version_achievements" USING btree ("_order");
  CREATE INDEX "_startups_v_version_achievements_parent_id_idx" ON "cms"."_startups_v_version_achievements" USING btree ("_parent_id");
  CREATE INDEX "_startups_v_parent_idx" ON "cms"."_startups_v" USING btree ("parent_id");
  CREATE INDEX "_startups_v_version_version_slug_idx" ON "cms"."_startups_v" USING btree ("version_slug");
  CREATE INDEX "_startups_v_version_version_stage_idx" ON "cms"."_startups_v" USING btree ("version_stage");
  CREATE INDEX "_startups_v_version_version_cohort_idx" ON "cms"."_startups_v" USING btree ("version_cohort_id");
  CREATE INDEX "_startups_v_version_version_logo_idx" ON "cms"."_startups_v" USING btree ("version_logo_id");
  CREATE INDEX "_startups_v_version_version_cover_image_idx" ON "cms"."_startups_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_startups_v_version_seo_version_seo_image_idx" ON "cms"."_startups_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_startups_v_version_version_updated_at_idx" ON "cms"."_startups_v" USING btree ("version_updated_at");
  CREATE INDEX "_startups_v_version_version_created_at_idx" ON "cms"."_startups_v" USING btree ("version_created_at");
  CREATE INDEX "_startups_v_version_version__status_idx" ON "cms"."_startups_v" USING btree ("version__status");
  CREATE INDEX "_startups_v_created_at_idx" ON "cms"."_startups_v" USING btree ("created_at");
  CREATE INDEX "_startups_v_updated_at_idx" ON "cms"."_startups_v" USING btree ("updated_at");
  CREATE INDEX "_startups_v_latest_idx" ON "cms"."_startups_v" USING btree ("latest");
  CREATE INDEX "_startups_v_rels_order_idx" ON "cms"."_startups_v_rels" USING btree ("order");
  CREATE INDEX "_startups_v_rels_parent_idx" ON "cms"."_startups_v_rels" USING btree ("parent_id");
  CREATE INDEX "_startups_v_rels_path_idx" ON "cms"."_startups_v_rels" USING btree ("path");
  CREATE INDEX "_startups_v_rels_founders_id_idx" ON "cms"."_startups_v_rels" USING btree ("founders_id");
  CREATE UNIQUE INDEX "founders_slug_idx" ON "cms"."founders" USING btree ("slug");
  CREATE INDEX "founders_photo_idx" ON "cms"."founders" USING btree ("photo_id");
  CREATE INDEX "founders_user_id_idx" ON "cms"."founders" USING btree ("user_id");
  CREATE INDEX "founders_updated_at_idx" ON "cms"."founders" USING btree ("updated_at");
  CREATE INDEX "founders_created_at_idx" ON "cms"."founders" USING btree ("created_at");
  CREATE INDEX "founders__status_idx" ON "cms"."founders" USING btree ("_status");
  CREATE INDEX "_founders_v_parent_idx" ON "cms"."_founders_v" USING btree ("parent_id");
  CREATE INDEX "_founders_v_version_version_slug_idx" ON "cms"."_founders_v" USING btree ("version_slug");
  CREATE INDEX "_founders_v_version_version_photo_idx" ON "cms"."_founders_v" USING btree ("version_photo_id");
  CREATE INDEX "_founders_v_version_version_user_id_idx" ON "cms"."_founders_v" USING btree ("version_user_id");
  CREATE INDEX "_founders_v_version_version_updated_at_idx" ON "cms"."_founders_v" USING btree ("version_updated_at");
  CREATE INDEX "_founders_v_version_version_created_at_idx" ON "cms"."_founders_v" USING btree ("version_created_at");
  CREATE INDEX "_founders_v_version_version__status_idx" ON "cms"."_founders_v" USING btree ("version__status");
  CREATE INDEX "_founders_v_created_at_idx" ON "cms"."_founders_v" USING btree ("created_at");
  CREATE INDEX "_founders_v_updated_at_idx" ON "cms"."_founders_v" USING btree ("updated_at");
  CREATE INDEX "_founders_v_latest_idx" ON "cms"."_founders_v" USING btree ("latest");
  CREATE INDEX "mentors_expertise_order_idx" ON "cms"."mentors_expertise" USING btree ("order");
  CREATE INDEX "mentors_expertise_parent_idx" ON "cms"."mentors_expertise" USING btree ("parent_id");
  CREATE INDEX "mentors_expertise_value_idx" ON "cms"."mentors_expertise" USING btree ("value");
  CREATE INDEX "mentors_sectors_order_idx" ON "cms"."mentors_sectors" USING btree ("order");
  CREATE INDEX "mentors_sectors_parent_idx" ON "cms"."mentors_sectors" USING btree ("parent_id");
  CREATE UNIQUE INDEX "mentors_slug_idx" ON "cms"."mentors" USING btree ("slug");
  CREATE INDEX "mentors_photo_idx" ON "cms"."mentors" USING btree ("photo_id");
  CREATE INDEX "mentors_user_id_idx" ON "cms"."mentors" USING btree ("user_id");
  CREATE INDEX "mentors_updated_at_idx" ON "cms"."mentors" USING btree ("updated_at");
  CREATE INDEX "mentors_created_at_idx" ON "cms"."mentors" USING btree ("created_at");
  CREATE INDEX "mentors__status_idx" ON "cms"."mentors" USING btree ("_status");
  CREATE INDEX "_mentors_v_version_expertise_order_idx" ON "cms"."_mentors_v_version_expertise" USING btree ("order");
  CREATE INDEX "_mentors_v_version_expertise_parent_idx" ON "cms"."_mentors_v_version_expertise" USING btree ("parent_id");
  CREATE INDEX "_mentors_v_version_expertise_value_idx" ON "cms"."_mentors_v_version_expertise" USING btree ("value");
  CREATE INDEX "_mentors_v_version_sectors_order_idx" ON "cms"."_mentors_v_version_sectors" USING btree ("order");
  CREATE INDEX "_mentors_v_version_sectors_parent_idx" ON "cms"."_mentors_v_version_sectors" USING btree ("parent_id");
  CREATE INDEX "_mentors_v_parent_idx" ON "cms"."_mentors_v" USING btree ("parent_id");
  CREATE INDEX "_mentors_v_version_version_slug_idx" ON "cms"."_mentors_v" USING btree ("version_slug");
  CREATE INDEX "_mentors_v_version_version_photo_idx" ON "cms"."_mentors_v" USING btree ("version_photo_id");
  CREATE INDEX "_mentors_v_version_version_user_id_idx" ON "cms"."_mentors_v" USING btree ("version_user_id");
  CREATE INDEX "_mentors_v_version_version_updated_at_idx" ON "cms"."_mentors_v" USING btree ("version_updated_at");
  CREATE INDEX "_mentors_v_version_version_created_at_idx" ON "cms"."_mentors_v" USING btree ("version_created_at");
  CREATE INDEX "_mentors_v_version_version__status_idx" ON "cms"."_mentors_v" USING btree ("version__status");
  CREATE INDEX "_mentors_v_created_at_idx" ON "cms"."_mentors_v" USING btree ("created_at");
  CREATE INDEX "_mentors_v_updated_at_idx" ON "cms"."_mentors_v" USING btree ("updated_at");
  CREATE INDEX "_mentors_v_latest_idx" ON "cms"."_mentors_v" USING btree ("latest");
  CREATE UNIQUE INDEX "partners_slug_idx" ON "cms"."partners" USING btree ("slug");
  CREATE INDEX "partners_logo_idx" ON "cms"."partners" USING btree ("logo_id");
  CREATE INDEX "partners_updated_at_idx" ON "cms"."partners" USING btree ("updated_at");
  CREATE INDEX "partners_created_at_idx" ON "cms"."partners" USING btree ("created_at");
  CREATE INDEX "partners__status_idx" ON "cms"."partners" USING btree ("_status");
  CREATE INDEX "_partners_v_parent_idx" ON "cms"."_partners_v" USING btree ("parent_id");
  CREATE INDEX "_partners_v_version_version_slug_idx" ON "cms"."_partners_v" USING btree ("version_slug");
  CREATE INDEX "_partners_v_version_version_logo_idx" ON "cms"."_partners_v" USING btree ("version_logo_id");
  CREATE INDEX "_partners_v_version_version_updated_at_idx" ON "cms"."_partners_v" USING btree ("version_updated_at");
  CREATE INDEX "_partners_v_version_version_created_at_idx" ON "cms"."_partners_v" USING btree ("version_created_at");
  CREATE INDEX "_partners_v_version_version__status_idx" ON "cms"."_partners_v" USING btree ("version__status");
  CREATE INDEX "_partners_v_created_at_idx" ON "cms"."_partners_v" USING btree ("created_at");
  CREATE INDEX "_partners_v_updated_at_idx" ON "cms"."_partners_v" USING btree ("updated_at");
  CREATE INDEX "_partners_v_latest_idx" ON "cms"."_partners_v" USING btree ("latest");
  CREATE INDEX "events_speakers_order_idx" ON "cms"."events_speakers" USING btree ("_order");
  CREATE INDEX "events_speakers_parent_id_idx" ON "cms"."events_speakers" USING btree ("_parent_id");
  CREATE INDEX "events_speakers_photo_idx" ON "cms"."events_speakers" USING btree ("photo_id");
  CREATE INDEX "events_relevant_stages_order_idx" ON "cms"."events_relevant_stages" USING btree ("order");
  CREATE INDEX "events_relevant_stages_parent_idx" ON "cms"."events_relevant_stages" USING btree ("parent_id");
  CREATE INDEX "events_sectors_order_idx" ON "cms"."events_sectors" USING btree ("order");
  CREATE INDEX "events_sectors_parent_idx" ON "cms"."events_sectors" USING btree ("parent_id");
  CREATE UNIQUE INDEX "events_slug_idx" ON "cms"."events" USING btree ("slug");
  CREATE INDEX "events_starts_at_idx" ON "cms"."events" USING btree ("starts_at");
  CREATE INDEX "events_program_idx" ON "cms"."events" USING btree ("program_id");
  CREATE INDEX "events_cohort_idx" ON "cms"."events" USING btree ("cohort_id");
  CREATE INDEX "events_hero_image_idx" ON "cms"."events" USING btree ("hero_image_id");
  CREATE INDEX "events_seo_seo_image_idx" ON "cms"."events" USING btree ("seo_image_id");
  CREATE INDEX "events_updated_at_idx" ON "cms"."events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "cms"."events" USING btree ("created_at");
  CREATE INDEX "events__status_idx" ON "cms"."events" USING btree ("_status");
  CREATE INDEX "events_rels_order_idx" ON "cms"."events_rels" USING btree ("order");
  CREATE INDEX "events_rels_parent_idx" ON "cms"."events_rels" USING btree ("parent_id");
  CREATE INDEX "events_rels_path_idx" ON "cms"."events_rels" USING btree ("path");
  CREATE INDEX "events_rels_mentors_id_idx" ON "cms"."events_rels" USING btree ("mentors_id");
  CREATE INDEX "_events_v_version_speakers_order_idx" ON "cms"."_events_v_version_speakers" USING btree ("_order");
  CREATE INDEX "_events_v_version_speakers_parent_id_idx" ON "cms"."_events_v_version_speakers" USING btree ("_parent_id");
  CREATE INDEX "_events_v_version_speakers_photo_idx" ON "cms"."_events_v_version_speakers" USING btree ("photo_id");
  CREATE INDEX "_events_v_version_relevant_stages_order_idx" ON "cms"."_events_v_version_relevant_stages" USING btree ("order");
  CREATE INDEX "_events_v_version_relevant_stages_parent_idx" ON "cms"."_events_v_version_relevant_stages" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_sectors_order_idx" ON "cms"."_events_v_version_sectors" USING btree ("order");
  CREATE INDEX "_events_v_version_sectors_parent_idx" ON "cms"."_events_v_version_sectors" USING btree ("parent_id");
  CREATE INDEX "_events_v_parent_idx" ON "cms"."_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_slug_idx" ON "cms"."_events_v" USING btree ("version_slug");
  CREATE INDEX "_events_v_version_version_starts_at_idx" ON "cms"."_events_v" USING btree ("version_starts_at");
  CREATE INDEX "_events_v_version_version_program_idx" ON "cms"."_events_v" USING btree ("version_program_id");
  CREATE INDEX "_events_v_version_version_cohort_idx" ON "cms"."_events_v" USING btree ("version_cohort_id");
  CREATE INDEX "_events_v_version_version_hero_image_idx" ON "cms"."_events_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_events_v_version_seo_version_seo_image_idx" ON "cms"."_events_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "cms"."_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "cms"."_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_version_version__status_idx" ON "cms"."_events_v" USING btree ("version__status");
  CREATE INDEX "_events_v_created_at_idx" ON "cms"."_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "cms"."_events_v" USING btree ("updated_at");
  CREATE INDEX "_events_v_latest_idx" ON "cms"."_events_v" USING btree ("latest");
  CREATE INDEX "_events_v_rels_order_idx" ON "cms"."_events_v_rels" USING btree ("order");
  CREATE INDEX "_events_v_rels_parent_idx" ON "cms"."_events_v_rels" USING btree ("parent_id");
  CREATE INDEX "_events_v_rels_path_idx" ON "cms"."_events_v_rels" USING btree ("path");
  CREATE INDEX "_events_v_rels_mentors_id_idx" ON "cms"."_events_v_rels" USING btree ("mentors_id");
  CREATE INDEX "resources_stages_order_idx" ON "cms"."resources_stages" USING btree ("order");
  CREATE INDEX "resources_stages_parent_idx" ON "cms"."resources_stages" USING btree ("parent_id");
  CREATE INDEX "resources_stages_value_idx" ON "cms"."resources_stages" USING btree ("value");
  CREATE INDEX "resources_topics_order_idx" ON "cms"."resources_topics" USING btree ("order");
  CREATE INDEX "resources_topics_parent_idx" ON "cms"."resources_topics" USING btree ("parent_id");
  CREATE UNIQUE INDEX "resources_slug_idx" ON "cms"."resources" USING btree ("slug");
  CREATE INDEX "resources_file_idx" ON "cms"."resources" USING btree ("file_id");
  CREATE INDEX "resources_seo_seo_image_idx" ON "cms"."resources" USING btree ("seo_image_id");
  CREATE INDEX "resources_updated_at_idx" ON "cms"."resources" USING btree ("updated_at");
  CREATE INDEX "resources_created_at_idx" ON "cms"."resources" USING btree ("created_at");
  CREATE INDEX "resources__status_idx" ON "cms"."resources" USING btree ("_status");
  CREATE INDEX "_resources_v_version_stages_order_idx" ON "cms"."_resources_v_version_stages" USING btree ("order");
  CREATE INDEX "_resources_v_version_stages_parent_idx" ON "cms"."_resources_v_version_stages" USING btree ("parent_id");
  CREATE INDEX "_resources_v_version_stages_value_idx" ON "cms"."_resources_v_version_stages" USING btree ("value");
  CREATE INDEX "_resources_v_version_topics_order_idx" ON "cms"."_resources_v_version_topics" USING btree ("order");
  CREATE INDEX "_resources_v_version_topics_parent_idx" ON "cms"."_resources_v_version_topics" USING btree ("parent_id");
  CREATE INDEX "_resources_v_parent_idx" ON "cms"."_resources_v" USING btree ("parent_id");
  CREATE INDEX "_resources_v_version_version_slug_idx" ON "cms"."_resources_v" USING btree ("version_slug");
  CREATE INDEX "_resources_v_version_version_file_idx" ON "cms"."_resources_v" USING btree ("version_file_id");
  CREATE INDEX "_resources_v_version_seo_version_seo_image_idx" ON "cms"."_resources_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_resources_v_version_version_updated_at_idx" ON "cms"."_resources_v" USING btree ("version_updated_at");
  CREATE INDEX "_resources_v_version_version_created_at_idx" ON "cms"."_resources_v" USING btree ("version_created_at");
  CREATE INDEX "_resources_v_version_version__status_idx" ON "cms"."_resources_v" USING btree ("version__status");
  CREATE INDEX "_resources_v_created_at_idx" ON "cms"."_resources_v" USING btree ("created_at");
  CREATE INDEX "_resources_v_updated_at_idx" ON "cms"."_resources_v" USING btree ("updated_at");
  CREATE INDEX "_resources_v_latest_idx" ON "cms"."_resources_v" USING btree ("latest");
  CREATE UNIQUE INDEX "articles_slug_idx" ON "cms"."articles" USING btree ("slug");
  CREATE INDEX "articles_published_at_idx" ON "cms"."articles" USING btree ("published_at");
  CREATE INDEX "articles_startup_idx" ON "cms"."articles" USING btree ("startup_id");
  CREATE INDEX "articles_hero_image_idx" ON "cms"."articles" USING btree ("hero_image_id");
  CREATE INDEX "articles_seo_seo_image_idx" ON "cms"."articles" USING btree ("seo_image_id");
  CREATE INDEX "articles_updated_at_idx" ON "cms"."articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "cms"."articles" USING btree ("created_at");
  CREATE INDEX "articles__status_idx" ON "cms"."articles" USING btree ("_status");
  CREATE INDEX "_articles_v_parent_idx" ON "cms"."_articles_v" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_version_slug_idx" ON "cms"."_articles_v" USING btree ("version_slug");
  CREATE INDEX "_articles_v_version_version_published_at_idx" ON "cms"."_articles_v" USING btree ("version_published_at");
  CREATE INDEX "_articles_v_version_version_startup_idx" ON "cms"."_articles_v" USING btree ("version_startup_id");
  CREATE INDEX "_articles_v_version_version_hero_image_idx" ON "cms"."_articles_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_articles_v_version_seo_version_seo_image_idx" ON "cms"."_articles_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_articles_v_version_version_updated_at_idx" ON "cms"."_articles_v" USING btree ("version_updated_at");
  CREATE INDEX "_articles_v_version_version_created_at_idx" ON "cms"."_articles_v" USING btree ("version_created_at");
  CREATE INDEX "_articles_v_version_version__status_idx" ON "cms"."_articles_v" USING btree ("version__status");
  CREATE INDEX "_articles_v_created_at_idx" ON "cms"."_articles_v" USING btree ("created_at");
  CREATE INDEX "_articles_v_updated_at_idx" ON "cms"."_articles_v" USING btree ("updated_at");
  CREATE INDEX "_articles_v_latest_idx" ON "cms"."_articles_v" USING btree ("latest");
  CREATE INDEX "infrastructure_equipment_order_idx" ON "cms"."infrastructure_equipment" USING btree ("_order");
  CREATE INDEX "infrastructure_equipment_parent_id_idx" ON "cms"."infrastructure_equipment" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "infrastructure_slug_idx" ON "cms"."infrastructure" USING btree ("slug");
  CREATE INDEX "infrastructure_updated_at_idx" ON "cms"."infrastructure" USING btree ("updated_at");
  CREATE INDEX "infrastructure_created_at_idx" ON "cms"."infrastructure" USING btree ("created_at");
  CREATE INDEX "infrastructure__status_idx" ON "cms"."infrastructure" USING btree ("_status");
  CREATE INDEX "infrastructure_rels_order_idx" ON "cms"."infrastructure_rels" USING btree ("order");
  CREATE INDEX "infrastructure_rels_parent_idx" ON "cms"."infrastructure_rels" USING btree ("parent_id");
  CREATE INDEX "infrastructure_rels_path_idx" ON "cms"."infrastructure_rels" USING btree ("path");
  CREATE INDEX "infrastructure_rels_media_id_idx" ON "cms"."infrastructure_rels" USING btree ("media_id");
  CREATE INDEX "_infrastructure_v_version_equipment_order_idx" ON "cms"."_infrastructure_v_version_equipment" USING btree ("_order");
  CREATE INDEX "_infrastructure_v_version_equipment_parent_id_idx" ON "cms"."_infrastructure_v_version_equipment" USING btree ("_parent_id");
  CREATE INDEX "_infrastructure_v_parent_idx" ON "cms"."_infrastructure_v" USING btree ("parent_id");
  CREATE INDEX "_infrastructure_v_version_version_slug_idx" ON "cms"."_infrastructure_v" USING btree ("version_slug");
  CREATE INDEX "_infrastructure_v_version_version_updated_at_idx" ON "cms"."_infrastructure_v" USING btree ("version_updated_at");
  CREATE INDEX "_infrastructure_v_version_version_created_at_idx" ON "cms"."_infrastructure_v" USING btree ("version_created_at");
  CREATE INDEX "_infrastructure_v_version_version__status_idx" ON "cms"."_infrastructure_v" USING btree ("version__status");
  CREATE INDEX "_infrastructure_v_created_at_idx" ON "cms"."_infrastructure_v" USING btree ("created_at");
  CREATE INDEX "_infrastructure_v_updated_at_idx" ON "cms"."_infrastructure_v" USING btree ("updated_at");
  CREATE INDEX "_infrastructure_v_latest_idx" ON "cms"."_infrastructure_v" USING btree ("latest");
  CREATE INDEX "_infrastructure_v_rels_order_idx" ON "cms"."_infrastructure_v_rels" USING btree ("order");
  CREATE INDEX "_infrastructure_v_rels_parent_idx" ON "cms"."_infrastructure_v_rels" USING btree ("parent_id");
  CREATE INDEX "_infrastructure_v_rels_path_idx" ON "cms"."_infrastructure_v_rels" USING btree ("path");
  CREATE INDEX "_infrastructure_v_rels_media_id_idx" ON "cms"."_infrastructure_v_rels" USING btree ("media_id");
  CREATE INDEX "lab_bookings_infrastructure_idx" ON "cms"."lab_bookings" USING btree ("infrastructure_id");
  CREATE INDEX "lab_bookings_updated_at_idx" ON "cms"."lab_bookings" USING btree ("updated_at");
  CREATE INDEX "lab_bookings_created_at_idx" ON "cms"."lab_bookings" USING btree ("created_at");
  CREATE INDEX "testimonials_photo_idx" ON "cms"."testimonials" USING btree ("photo_id");
  CREATE INDEX "testimonials_startup_idx" ON "cms"."testimonials" USING btree ("startup_id");
  CREATE INDEX "testimonials_program_idx" ON "cms"."testimonials" USING btree ("program_id");
  CREATE INDEX "testimonials_updated_at_idx" ON "cms"."testimonials" USING btree ("updated_at");
  CREATE INDEX "testimonials_created_at_idx" ON "cms"."testimonials" USING btree ("created_at");
  CREATE INDEX "faqs_updated_at_idx" ON "cms"."faqs" USING btree ("updated_at");
  CREATE INDEX "faqs_created_at_idx" ON "cms"."faqs" USING btree ("created_at");
  CREATE INDEX "metrics_updated_at_idx" ON "cms"."metrics" USING btree ("updated_at");
  CREATE INDEX "metrics_created_at_idx" ON "cms"."metrics" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "cms"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "cms"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "cms"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "cms"."media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "cms"."media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "cms"."media" USING btree ("sizes_hero_filename");
  CREATE INDEX "staff_updated_at_idx" ON "cms"."staff" USING btree ("updated_at");
  CREATE INDEX "staff_created_at_idx" ON "cms"."staff" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_programs_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("programs_id");
  CREATE INDEX "payload_locked_documents_rels_cohorts_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("cohorts_id");
  CREATE INDEX "payload_locked_documents_rels_startups_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("startups_id");
  CREATE INDEX "payload_locked_documents_rels_founders_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("founders_id");
  CREATE INDEX "payload_locked_documents_rels_mentors_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("mentors_id");
  CREATE INDEX "payload_locked_documents_rels_partners_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("partners_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_resources_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("resources_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_infrastructure_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("infrastructure_id");
  CREATE INDEX "payload_locked_documents_rels_lab_bookings_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("lab_bookings_id");
  CREATE INDEX "payload_locked_documents_rels_testimonials_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("testimonials_id");
  CREATE INDEX "payload_locked_documents_rels_faqs_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("faqs_id");
  CREATE INDEX "payload_locked_documents_rels_metrics_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("metrics_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_staff_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("staff_id");
  CREATE INDEX "payload_preferences_key_idx" ON "cms"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "cms"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "cms"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "cms"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "cms"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "cms"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_staff_id_idx" ON "cms"."payload_preferences_rels" USING btree ("staff_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "cms"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "cms"."payload_migrations" USING btree ("created_at");
  CREATE INDEX "homepage_sections_order_idx" ON "cms"."homepage_sections" USING btree ("_order");
  CREATE INDEX "homepage_sections_parent_id_idx" ON "cms"."homepage_sections" USING btree ("_parent_id");
  CREATE INDEX "homepage_person_lines_order_idx" ON "cms"."homepage_person_lines" USING btree ("_order");
  CREATE INDEX "homepage_person_lines_parent_id_idx" ON "cms"."homepage_person_lines" USING btree ("_parent_id");
  CREATE INDEX "homepage_hero_media_idx" ON "cms"."homepage" USING btree ("hero_media_id");
  CREATE INDEX "homepage_rels_order_idx" ON "cms"."homepage_rels" USING btree ("order");
  CREATE INDEX "homepage_rels_parent_idx" ON "cms"."homepage_rels" USING btree ("parent_id");
  CREATE INDEX "homepage_rels_path_idx" ON "cms"."homepage_rels" USING btree ("path");
  CREATE INDEX "homepage_rels_programs_id_idx" ON "cms"."homepage_rels" USING btree ("programs_id");
  CREATE INDEX "homepage_rels_startups_id_idx" ON "cms"."homepage_rels" USING btree ("startups_id");
  CREATE INDEX "homepage_rels_events_id_idx" ON "cms"."homepage_rels" USING btree ("events_id");
  CREATE INDEX "homepage_rels_testimonials_id_idx" ON "cms"."homepage_rels" USING btree ("testimonials_id");
  CREATE INDEX "homepage_rels_metrics_id_idx" ON "cms"."homepage_rels" USING btree ("metrics_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms"."programs_timeline" CASCADE;
  DROP TABLE "cms"."programs_faqs" CASCADE;
  DROP TABLE "cms"."programs_stage" CASCADE;
  DROP TABLE "cms"."programs_sectors" CASCADE;
  DROP TABLE "cms"."programs_audience" CASCADE;
  DROP TABLE "cms"."programs_application_questions_options" CASCADE;
  DROP TABLE "cms"."programs_application_questions" CASCADE;
  DROP TABLE "cms"."programs" CASCADE;
  DROP TABLE "cms"."programs_rels" CASCADE;
  DROP TABLE "cms"."_programs_v_version_timeline" CASCADE;
  DROP TABLE "cms"."_programs_v_version_faqs" CASCADE;
  DROP TABLE "cms"."_programs_v_version_stage" CASCADE;
  DROP TABLE "cms"."_programs_v_version_sectors" CASCADE;
  DROP TABLE "cms"."_programs_v_version_audience" CASCADE;
  DROP TABLE "cms"."_programs_v_version_application_questions_options" CASCADE;
  DROP TABLE "cms"."_programs_v_version_application_questions" CASCADE;
  DROP TABLE "cms"."_programs_v" CASCADE;
  DROP TABLE "cms"."_programs_v_rels" CASCADE;
  DROP TABLE "cms"."cohorts" CASCADE;
  DROP TABLE "cms"."cohorts_rels" CASCADE;
  DROP TABLE "cms"."startups_story" CASCADE;
  DROP TABLE "cms"."startups_sectors" CASCADE;
  DROP TABLE "cms"."startups_achievements" CASCADE;
  DROP TABLE "cms"."startups" CASCADE;
  DROP TABLE "cms"."startups_rels" CASCADE;
  DROP TABLE "cms"."_startups_v_version_story" CASCADE;
  DROP TABLE "cms"."_startups_v_version_sectors" CASCADE;
  DROP TABLE "cms"."_startups_v_version_achievements" CASCADE;
  DROP TABLE "cms"."_startups_v" CASCADE;
  DROP TABLE "cms"."_startups_v_rels" CASCADE;
  DROP TABLE "cms"."founders" CASCADE;
  DROP TABLE "cms"."_founders_v" CASCADE;
  DROP TABLE "cms"."mentors_expertise" CASCADE;
  DROP TABLE "cms"."mentors_sectors" CASCADE;
  DROP TABLE "cms"."mentors" CASCADE;
  DROP TABLE "cms"."_mentors_v_version_expertise" CASCADE;
  DROP TABLE "cms"."_mentors_v_version_sectors" CASCADE;
  DROP TABLE "cms"."_mentors_v" CASCADE;
  DROP TABLE "cms"."partners" CASCADE;
  DROP TABLE "cms"."_partners_v" CASCADE;
  DROP TABLE "cms"."events_speakers" CASCADE;
  DROP TABLE "cms"."events_relevant_stages" CASCADE;
  DROP TABLE "cms"."events_sectors" CASCADE;
  DROP TABLE "cms"."events" CASCADE;
  DROP TABLE "cms"."events_rels" CASCADE;
  DROP TABLE "cms"."_events_v_version_speakers" CASCADE;
  DROP TABLE "cms"."_events_v_version_relevant_stages" CASCADE;
  DROP TABLE "cms"."_events_v_version_sectors" CASCADE;
  DROP TABLE "cms"."_events_v" CASCADE;
  DROP TABLE "cms"."_events_v_rels" CASCADE;
  DROP TABLE "cms"."resources_stages" CASCADE;
  DROP TABLE "cms"."resources_topics" CASCADE;
  DROP TABLE "cms"."resources" CASCADE;
  DROP TABLE "cms"."_resources_v_version_stages" CASCADE;
  DROP TABLE "cms"."_resources_v_version_topics" CASCADE;
  DROP TABLE "cms"."_resources_v" CASCADE;
  DROP TABLE "cms"."articles" CASCADE;
  DROP TABLE "cms"."_articles_v" CASCADE;
  DROP TABLE "cms"."infrastructure_equipment" CASCADE;
  DROP TABLE "cms"."infrastructure" CASCADE;
  DROP TABLE "cms"."infrastructure_rels" CASCADE;
  DROP TABLE "cms"."_infrastructure_v_version_equipment" CASCADE;
  DROP TABLE "cms"."_infrastructure_v" CASCADE;
  DROP TABLE "cms"."_infrastructure_v_rels" CASCADE;
  DROP TABLE "cms"."lab_bookings" CASCADE;
  DROP TABLE "cms"."testimonials" CASCADE;
  DROP TABLE "cms"."faqs" CASCADE;
  DROP TABLE "cms"."metrics" CASCADE;
  DROP TABLE "cms"."media" CASCADE;
  DROP TABLE "cms"."staff" CASCADE;
  DROP TABLE "cms"."payload_kv" CASCADE;
  DROP TABLE "cms"."payload_locked_documents" CASCADE;
  DROP TABLE "cms"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "cms"."payload_preferences" CASCADE;
  DROP TABLE "cms"."payload_preferences_rels" CASCADE;
  DROP TABLE "cms"."payload_migrations" CASCADE;
  DROP TABLE "cms"."homepage_sections" CASCADE;
  DROP TABLE "cms"."homepage_person_lines" CASCADE;
  DROP TABLE "cms"."homepage" CASCADE;
  DROP TABLE "cms"."homepage_rels" CASCADE;
  DROP TYPE "cms"."enum_programs_stage";
  DROP TYPE "cms"."enum_programs_sectors";
  DROP TYPE "cms"."enum_programs_audience";
  DROP TYPE "cms"."enum_programs_application_questions_field_type";
  DROP TYPE "cms"."enum_programs_format";
  DROP TYPE "cms"."enum_programs_application_status";
  DROP TYPE "cms"."enum_programs_status";
  DROP TYPE "cms"."enum__programs_v_version_stage";
  DROP TYPE "cms"."enum__programs_v_version_sectors";
  DROP TYPE "cms"."enum__programs_v_version_audience";
  DROP TYPE "cms"."enum__programs_v_version_application_questions_field_type";
  DROP TYPE "cms"."enum__programs_v_version_format";
  DROP TYPE "cms"."enum__programs_v_version_application_status";
  DROP TYPE "cms"."enum__programs_v_version_status";
  DROP TYPE "cms"."enum_cohorts_status";
  DROP TYPE "cms"."enum_startups_story_stage";
  DROP TYPE "cms"."enum_startups_sectors";
  DROP TYPE "cms"."enum_startups_stage";
  DROP TYPE "cms"."enum_startups_status";
  DROP TYPE "cms"."enum__startups_v_version_story_stage";
  DROP TYPE "cms"."enum__startups_v_version_sectors";
  DROP TYPE "cms"."enum__startups_v_version_stage";
  DROP TYPE "cms"."enum__startups_v_version_status";
  DROP TYPE "cms"."enum_founders_status";
  DROP TYPE "cms"."enum__founders_v_version_status";
  DROP TYPE "cms"."enum_mentors_expertise";
  DROP TYPE "cms"."enum_mentors_sectors";
  DROP TYPE "cms"."enum_mentors_availability";
  DROP TYPE "cms"."enum_mentors_status";
  DROP TYPE "cms"."enum__mentors_v_version_expertise";
  DROP TYPE "cms"."enum__mentors_v_version_sectors";
  DROP TYPE "cms"."enum__mentors_v_version_availability";
  DROP TYPE "cms"."enum__mentors_v_version_status";
  DROP TYPE "cms"."enum_partners_type";
  DROP TYPE "cms"."enum_partners_status";
  DROP TYPE "cms"."enum__partners_v_version_type";
  DROP TYPE "cms"."enum__partners_v_version_status";
  DROP TYPE "cms"."enum_events_relevant_stages";
  DROP TYPE "cms"."enum_events_sectors";
  DROP TYPE "cms"."enum_events_event_type";
  DROP TYPE "cms"."enum_events_format";
  DROP TYPE "cms"."enum_events_status";
  DROP TYPE "cms"."enum__events_v_version_relevant_stages";
  DROP TYPE "cms"."enum__events_v_version_sectors";
  DROP TYPE "cms"."enum__events_v_version_event_type";
  DROP TYPE "cms"."enum__events_v_version_format";
  DROP TYPE "cms"."enum__events_v_version_status";
  DROP TYPE "cms"."enum_resources_stages";
  DROP TYPE "cms"."enum_resources_topics";
  DROP TYPE "cms"."enum_resources_format";
  DROP TYPE "cms"."enum_resources_status";
  DROP TYPE "cms"."enum__resources_v_version_stages";
  DROP TYPE "cms"."enum__resources_v_version_topics";
  DROP TYPE "cms"."enum__resources_v_version_format";
  DROP TYPE "cms"."enum__resources_v_version_status";
  DROP TYPE "cms"."enum_articles_status";
  DROP TYPE "cms"."enum__articles_v_version_status";
  DROP TYPE "cms"."enum_infrastructure_space_type";
  DROP TYPE "cms"."enum_infrastructure_status";
  DROP TYPE "cms"."enum__infrastructure_v_version_space_type";
  DROP TYPE "cms"."enum__infrastructure_v_version_status";
  DROP TYPE "cms"."enum_lab_bookings_status";
  DROP TYPE "cms"."enum_faqs_category";
  DROP TYPE "cms"."enum_homepage_sections_key";`)
}
