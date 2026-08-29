import { pgSchema } from 'drizzle-orm/pg-core'

/**
 * The `app` schema holds OPERATIONAL data (spec §32).
 *
 * Payload owns the `cms` schema and everything editorial in it. Nothing in this
 * file may be duplicated into a Payload collection: cross-schema references are
 * by stable ID and are resolved in `src/server/services/`, never by joining
 * across schemas inside a page component.
 */
export const appSchema = pgSchema('app')

/**
 * Two independent role axes (spec §02, §24).
 *
 * They are separate columns rather than one enum so that a person can be a
 * founder on the platform AND run the mentor programme for staff, without a
 * permission matrix. §24 forbids granular permissions in V1, so both stay coarse.
 */
export const platformRole = appSchema.enum('platform_role', [
  'student',
  'founder',
  'mentor',
  'investor',
  'alumni',
  'partner',
  'other',
])

export const staffRole = appSchema.enum('staff_role', [
  'reviewer',
  'content_admin',
  'program_manager',
  'startup_manager',
  'mentor_manager',
  'super_admin',
])

/** Where someone is in their entrepreneurship journey (spec §09 step 3). */
export const journeyStage = appSchema.enum('journey_stage', [
  'exploring',
  'idea',
  'validation',
  'mvp',
  'early_revenue',
  'scaling',
  'established',
])

/** What a user controls about their own visibility (spec §26). */
export const profileVisibility = appSchema.enum('profile_visibility', [
  'public',
  'community',
  'private',
])

/**
 * A mentor's stated availability, collected in onboarding step 5 for the
 * mentor role. Mirrors the values on the CMS Mentors collection so a staff
 * member turning this into a public profile isn't translating between two
 * vocabularies.
 */
export const mentorAvailability = appSchema.enum('mentor_availability', [
  'open',
  'limited',
  'unavailable',
])

/**
 * Application lifecycle (spec §18). draft -> submitted is the only transition
 * the applicant can trigger; everything after is staff-driven and enforced
 * server-side by an explicit transition table (src/server/applications/
 * transitions.ts) — an application cannot skip from submitted to accepted.
 */
export const applicationStatus = appSchema.enum('application_status', [
  'draft',
  'submitted',
  'under_review',
  'shortlisted',
  'interview',
  'accepted',
  'rejected',
  'waitlisted',
])

/** The six field types a program's application question set can use (spec §18). */
export const applicationFieldType = appSchema.enum('application_field_type', [
  'text',
  'textarea',
  'select',
  'multiselect',
  'url',
  'file',
])

export const notificationType = appSchema.enum('notification_type', [
  'application_received',
  'application_status_changed',
  'application_deadline_reminder',
])
