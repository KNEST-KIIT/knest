import { relations, sql } from 'drizzle-orm'
import { index, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { appSchema, levelRequestStatus } from './enums'
import { users } from './users'

/**
 * A founder's request to be moved up a level, and the record of what staff
 * decided.
 *
 * Levels are the one thing about a founder that KNEST asserts rather than the
 * founder claiming it — `users.journeyStage` stays self-declared and grants
 * nothing, while `users.founderLevel` grants real access and can only move
 * through an approved row here. That split is the whole design: a claim and a
 * credential are different objects and are stored as different columns.
 *
 * `evidence` is the founder's own case for the level, in their words. It is
 * kept after the decision rather than discarded, because the next reviewer's
 * first question is always what the last one was shown.
 */
export const levelRequests = appSchema.table(
  'level_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The level being asked for, not the delta — so the row still reads correctly if the current level later changes. */
    requestedLevel: integer('requested_level').notNull(),
    status: levelRequestStatus('status').notNull().default('pending'),
    evidence: text('evidence').notNull(),

    /** Null while pending. `restrict` so a staff account with decisions behind it cannot be deleted out from under them. */
    decidedByUserId: text('decided_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    decidedAt: timestamp('decided_at', { mode: 'date', withTimezone: true }),
    /** Shown to the founder, unlike an application's internal note — a refused level needs a reason to act on. */
    decisionNote: text('decision_note'),

    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /**
     * One open request per person, enforced by the database rather than by a
     * read-then-write check in the action. PHASE-5-6-RETROSPECTIVE.md §4 records
     * an idempotency race found in exactly that pattern; a partial unique index
     * cannot race.
     */
    uniqueIndex('level_requests_one_pending_idx')
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
    index('level_requests_status_idx').on(table.status),
    index('level_requests_user_idx').on(table.userId),
  ],
)

export const levelRequestsRelations = relations(levelRequests, ({ one }) => ({
  user: one(users, {
    fields: [levelRequests.userId],
    references: [users.id],
    relationName: 'levelRequestSubject',
  }),
  decidedBy: one(users, {
    fields: [levelRequests.decidedByUserId],
    references: [users.id],
    relationName: 'levelRequestDecider',
  }),
}))
