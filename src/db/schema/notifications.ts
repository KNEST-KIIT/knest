import { relations } from 'drizzle-orm'
import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core'
import { appSchema, notificationType } from './enums'
import { applications } from './applications'
import { users } from './users'

/**
 * In-app notifications. Every write here is paired with an email in
 * src/server/notifications/send.ts — spec §25 requires both channels for
 * application status changes, and duplicating the call site rather than the
 * data model keeps the two channels independently readable in code.
 */
export const notifications = appSchema.table(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Where "view" should navigate — e.g. /dashboard/applications/[id]. */
    href: text('href'),
    applicationId: text('application_id').references(() => applications.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_idx').on(table.userId),
    index('notifications_user_unread_idx').on(table.userId, table.readAt),
  ],
)

/**
 * Every staff mutation of consequence, starting with application status
 * changes (spec §31). before/after are JSON snapshots of just the changed
 * fields, not full row dumps — enough to answer "what changed and by whom"
 * without duplicating the entire operational schema into every log line.
 */
export const auditLogs = appSchema.table(
  'audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_logs_entity_idx').on(table.entityType, table.entityId)],
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}))
