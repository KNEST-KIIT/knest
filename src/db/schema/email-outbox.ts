import { index, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { appSchema } from './enums'

export const emailStatus = appSchema.enum('email_status', ['pending', 'sent', 'expired', 'dead'])

/**
 * Durable outgoing mail. A message is written here BEFORE it is handed to the provider, so a
 * provider outage, a missing sender identity or a restart no longer loses a verification or
 * reset link: the worker (src/server/email/outbox.ts) retries with a growing delay until the
 * message is sent, runs out of attempts or passes `expires_at`.
 *
 * `body` can contain a single-use link. It is blanked as soon as the row is sent or expires.
 * A dead row keeps it for seven days so an operator can resend it; the retry worker then
 * blanks it, so the table does not accumulate live tokens.
 */
export const emailOutbox = appSchema.table(
  'email_outbox',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    toAddress: text('to_address').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: emailStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { mode: 'date', withTimezone: true }),
  },
  (table) => [index('email_outbox_due_idx').on(table.status, table.nextAttemptAt)],
)
