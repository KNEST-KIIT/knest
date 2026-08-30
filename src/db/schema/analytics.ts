import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core'
import { appSchema } from './enums'
import { users } from './users'

/**
 * Funnel-staged events (PHASE-10-12-IMPLEMENTATION-PLAN.md §3), not a click
 * log. `userId` is nullable with `onDelete: 'set null'` rather than
 * `cascade` — deliberately different from every other user-owned table in
 * this schema — because a funnel count should survive a user deleting their
 * account; only their identity is severed, not the fact that a stage was
 * reached. `sessionId` attributes anonymous stages (a landing view, a
 * journey-selector choice before signup) to one visit without requiring a
 * login.
 */
export const analyticsEvents = appSchema.table(
  'analytics_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: text('session_id').notNull(),
    event: text('event').notNull(),
    props: jsonb('props'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('analytics_events_event_idx').on(table.event),
    index('analytics_events_user_idx').on(table.userId),
  ],
)
