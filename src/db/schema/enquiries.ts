import { index, text, timestamp } from 'drizzle-orm/pg-core'
import { appSchema } from './enums'
import { users } from './users'

export const enquiryTopic = appSchema.enum('enquiry_topic', ['general', 'program', 'partnership', 'mentor', 'press', 'support'])
export const enquiryStatus = appSchema.enum('enquiry_status', ['new', 'handled'])

/**
 * Messages sent through the public contact form. Kept in `app`, not the CMS: they are
 * personal data (a name, an e-mail address, free text) and belong with the other member
 * data under the same access rules and retention decisions (HD-06).
 *
 * Staff read and close them from the admin area. Nothing here is shown publicly.
 */
export const enquiries = appSchema.table(
  'enquiries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    email: text('email').notNull(),
    topic: enquiryTopic('topic').notNull().default('general'),
    message: text('message').notNull(),
    status: enquiryStatus('status').notNull().default('new'),
    /** Set when the sender was signed in; null for anonymous visitors. Kept if the account is deleted. */
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    handledAt: timestamp('handled_at', { mode: 'date', withTimezone: true }),
    handledBy: text('handled_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [index('enquiries_status_created_idx').on(table.status, table.createdAt)],
)
