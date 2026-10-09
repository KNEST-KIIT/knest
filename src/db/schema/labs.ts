import { sql } from 'drizzle-orm'
import { boolean, check, date, index, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { appSchema } from './enums'
import { users } from './users'

/**
 * Lab booking (contract modules 25 to 29 and 32). Design: docs/delivery/LAB-BOOKING-DESIGN.md.
 *
 * Operational data lives here, in `app`, never in the CMS. Every operating rule is a column on
 * `labs`: the values below are recommended defaults from HD-16 and are NOT an approved policy. The
 * lab heads and KNEST set the real ones; nothing in the rules code hard-codes them.
 */

export const labEligibility = appSchema.enum('lab_eligibility', ['verified', 'onboarded'])
export const labStaffRole = appSchema.enum('lab_staff_role', ['head', 'assistant'])
export const labBookingStatus = appSchema.enum('lab_booking_status', [
  'requested',
  'approved',
  'rejected',
  'cancelled',
  'alternative_proposed',
  'completed',
  'no_show',
])
export const labAttendanceOutcome = appSchema.enum('lab_attendance_outcome', ['attended', 'no_show'])

export const labs = appSchema.table(
  'labs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    department: text('department').notNull().default(''),
    description: text('description'),
    /** The CMS `infrastructure` document that holds this lab's public photos and text, if any. A plain id: the schemas stay independent. */
    infrastructureId: integer('infrastructure_id'),
    capacity: integer('capacity').notNull().default(1),

    // ---- policy (recommended defaults, not approved; see the design note) ----
    slotMinutes: integer('slot_minutes').notNull().default(60),
    maxConsecutiveSlots: integer('max_consecutive_slots').notNull().default(3),
    minLeadMinutes: integer('min_lead_minutes').notNull().default(240),
    maxHorizonDays: integer('max_horizon_days').notNull().default(14),
    maxOpenRequests: integer('max_open_requests').notNull().default(3),
    maxHoursPerWeek: integer('max_hours_per_week').notNull().default(6),
    cancelCutoffMinutes: integer('cancel_cutoff_minutes').notNull().default(120),
    eligibility: labEligibility('eligibility').notNull().default('onboarded'),
    requiresAssistant: boolean('requires_assistant').notNull().default(false),

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('labs_slug_idx').on(t.slug),
    uniqueIndex('labs_infrastructure_idx').on(t.infrastructureId),
    check('labs_capacity_positive', sql`${t.capacity} > 0`),
    check('labs_slot_minutes_range', sql`${t.slotMinutes} between 15 and 480`),
    check('labs_policy_positive', sql`${t.maxConsecutiveSlots} > 0 and ${t.minLeadMinutes} >= 0 and ${t.maxHorizonDays} > 0 and ${t.maxOpenRequests} > 0 and ${t.maxHoursPerWeek} > 0 and ${t.cancelCutoffMinutes} >= 0`),
  ],
)

/** Operating windows in India Standard Time: weekday 0 (Sunday) to 6, minutes after midnight. Several per day are allowed. */
export const labHours = appSchema.table(
  'lab_hours',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    labId: text('lab_id').notNull().references(() => labs.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    opensMinute: integer('opens_minute').notNull(),
    closesMinute: integer('closes_minute').notNull(),
  },
  (t) => [
    index('lab_hours_lab_idx').on(t.labId, t.weekday),
    check('lab_hours_weekday', sql`${t.weekday} between 0 and 6`),
    check('lab_hours_window', sql`${t.opensMinute} >= 0 and ${t.closesMinute} <= 1440 and ${t.opensMinute} < ${t.closesMinute}`),
  ],
)

export const labBlackouts = appSchema.table(
  'lab_blackouts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    labId: text('lab_id').notNull().references(() => labs.id, { onDelete: 'cascade' }),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    reason: text('reason').notNull().default(''),
  },
  (t) => [index('lab_blackouts_lab_idx').on(t.labId, t.startsOn), check('lab_blackouts_order', sql`${t.endsOn} >= ${t.startsOn}`)],
)

/** Who runs a lab. A lab role comes only from here; it does not need a staff role in the console. */
export const labStaff = appSchema.table(
  'lab_staff',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    labId: text('lab_id').notNull().references(() => labs.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: labStaffRole('role').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('lab_staff_lab_user_idx').on(t.labId, t.userId), index('lab_staff_user_idx').on(t.userId)],
)

/**
 * A booking request and its life. Overlap is prevented by an exclusion constraint added in the
 * migration (drizzle cannot express it): two live bookings (requested, approved or alternative
 * proposed) of one lab may not overlap in time, whatever the application code does.
 */
export const labBookings = appSchema.table(
  'lab_bookings',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    // restrict: bookings are history and must outlive an attempt to delete their lab
    labId: text('lab_id').notNull().references(() => labs.id, { onDelete: 'restrict' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { mode: 'date', withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { mode: 'date', withTimezone: true }).notNull(),
    purpose: text('purpose').notNull(),
    headcount: integer('headcount').notNull().default(1),
    equipment: text('equipment'),
    status: labBookingStatus('status').notNull().default('requested'),
    decidedBy: text('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { mode: 'date', withTimezone: true }),
    decisionNote: text('decision_note'),
    /** An alternative the head proposes; the booker accepts or declines it. */
    proposedStartsAt: timestamp('proposed_starts_at', { mode: 'date', withTimezone: true }),
    proposedEndsAt: timestamp('proposed_ends_at', { mode: 'date', withTimezone: true }),
    assistantUserId: text('assistant_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('lab_bookings_lab_start_idx').on(t.labId, t.startsAt),
    index('lab_bookings_user_idx').on(t.userId, t.createdAt),
    index('lab_bookings_status_idx').on(t.status),
    index('lab_bookings_assistant_idx').on(t.assistantUserId, t.startsAt),
    check('lab_bookings_time_order', sql`${t.endsAt} > ${t.startsAt}`),
    check('lab_bookings_headcount', sql`${t.headcount} > 0`),
    check('lab_bookings_proposal_order', sql`${t.proposedStartsAt} is null or ${t.proposedEndsAt} > ${t.proposedStartsAt}`),
  ],
)

/** Manual attendance, by an assistant or head. Labelled `manual`; no automated check-in exists yet (QR is gated). */
export const labAttendance = appSchema.table(
  'lab_attendance',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    bookingId: text('booking_id').notNull().references(() => labBookings.id, { onDelete: 'cascade' }),
    outcome: labAttendanceOutcome('outcome').notNull(),
    markedBy: text('marked_by').references(() => users.id, { onDelete: 'set null' }),
    markedAt: timestamp('marked_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    reason: text('reason'),
    method: text('method').notNull().default('manual'),
  },
  (t) => [uniqueIndex('lab_attendance_booking_idx').on(t.bookingId)],
)
