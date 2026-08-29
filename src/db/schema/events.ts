import { relations } from 'drizzle-orm'
import { integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { appSchema } from './enums'
import { users } from './users'

/**
 * KNEST's own record of who's coming to its own events. Events.registrationUrl
 * (CMS) is for linking OUT to an external registration form; this table is
 * for events KNEST tracks registration for internally — without it there is
 * no way to build "your events" on the dashboard or an event reminder email.
 *
 * eventId is a Payload document id, stored as a plain integer rather than a
 * foreign key — the same cms/app independence as Application.programId
 * (spec §32): Payload's migrations and Drizzle's must stay separate.
 */
export const eventRegistrations = appSchema.table(
  'event_registrations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: integer('event_id').notNull(),
    registeredAt: timestamp('registered_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Idempotent registration, the same pattern as applications_user_program_idx
    // — and this time paired with onConflictDoNothing() at the call site from
    // the start (src/server/events/actions.ts), rather than the check-then-insert
    // race PHASE-5-6-RETROSPECTIVE.md §4 found in startApplication.
    uniqueIndex('event_registrations_user_event_idx').on(table.userId, table.eventId),
  ],
)

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  user: one(users, { fields: [eventRegistrations.userId], references: [users.id] }),
}))
