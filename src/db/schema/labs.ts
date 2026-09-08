import { relations } from 'drizzle-orm'
import { index, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { appSchema, labBookingStatus } from './enums'
import { users } from './users'

/**
 * A founder's request for time in a KIIT lab, and what that lab's manager
 * decided.
 *
 * KNEST brokers access to labs it does not own — they belong to the individual
 * KIIT schools — so a booking is a request until the owning school says
 * otherwise. That is why `requested` is the initial state and not `approved`.
 *
 * `labId` is a Payload document id held as a plain integer with no foreign key,
 * matching `event_registrations.eventId`: Payload owns the `cms` schema and
 * Drizzle owns `app`, and their migrations must stay separable (spec §32).
 * Referential integrity to the lab is checked in the server module via
 * Payload's API, not by the database.
 *
 * Overlap is prevented by a Postgres exclusion constraint rather than by
 * counting rows before inserting. `src/server/events/actions.ts` does the
 * latter for event capacity and has a real race at the boundary: two
 * concurrent registrations both read the old count and both succeed. For a
 * booking the same shape would double-book a room. The constraint is added by
 * hand in the migration because drizzle-kit cannot express EXCLUDE:
 *
 *   CREATE EXTENSION IF NOT EXISTS btree_gist;
 *   ALTER TABLE app.lab_bookings ADD CONSTRAINT lab_bookings_no_overlap
 *     EXCLUDE USING gist (lab_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
 *     WHERE (status = 'approved');
 *
 * Only approved rows participate, so any number of people may *ask* for the
 * same slot and the clash is resolved at the moment a manager approves one.
 */
export const labBookings = appSchema.table(
  'lab_bookings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Payload `labs` document id. Deliberately not a foreign key — see above. */
    labId: integer('lab_id').notNull(),

    startsAt: timestamp('starts_at', { mode: 'date', withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { mode: 'date', withTimezone: true }).notNull(),
    /** What the lab is for, in the founder's words. A manager approving an unfamiliar name needs it. */
    purpose: text('purpose').notNull(),

    status: labBookingStatus('status').notNull().default('requested'),
    decidedByUserId: text('decided_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    decidedAt: timestamp('decided_at', { mode: 'date', withTimezone: true }),
    decisionNote: text('decision_note'),

    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /** The manager queue reads by lab and then by time. */
    index('lab_bookings_lab_starts_idx').on(table.labId, table.startsAt),
    index('lab_bookings_user_idx').on(table.userId),
    index('lab_bookings_status_idx').on(table.status),
  ],
)

export const labBookingsRelations = relations(labBookings, ({ one }) => ({
  user: one(users, {
    fields: [labBookings.userId],
    references: [users.id],
    relationName: 'labBookingSubject',
  }),
  decidedBy: one(users, {
    fields: [labBookings.decidedByUserId],
    references: [users.id],
    relationName: 'labBookingDecider',
  }),
}))
