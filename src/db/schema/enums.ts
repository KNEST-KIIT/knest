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
  'level_request_received',
  'level_decision',
  'lab_booking_received',
  'lab_booking_decision',
])

/**
 * A founder's request to be moved up a level (spec §02 — levels are granted by
 * KNEST, never self-declared).
 *
 * `withdrawn` is the founder's own exit from a pending request; the other two
 * ends are staff decisions. There is no `needs_evidence` state on purpose: a
 * request that is not good enough is rejected with a note, and the founder
 * opens a new one. A request that can be sent back and forth indefinitely has
 * no queue depth anyone can trust.
 */
export const levelRequestStatus = appSchema.enum('level_request_status', [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
])

/**
 * A booking of a KIIT lab.
 *
 * `requested` until the lab's own manager decides — KNEST does not own the labs
 * it is brokering access to, so nothing is confirmed by the act of asking.
 * `cancelled` is reachable by the founder before the slot, and by a manager
 * after approving, which is why it is separate from `rejected`.
 */
export const labBookingStatus = appSchema.enum('lab_booking_status', [
  'requested',
  'approved',
  'rejected',
  'cancelled',
])
