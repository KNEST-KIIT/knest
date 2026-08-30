import { db } from '@/db/client'
import { notifications, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from '@/server/email/send'
import type { notificationType } from '@/db/schema'

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export type NotifyInput = {
  userId: string
  type: (typeof notificationType.enumValues)[number]
  title: string
  body: string
  href?: string
  applicationId?: string
  email: { subject: string; text: string }
}

/**
 * The in-app notification's DB write only, taking either the module-level
 * `db` or a transaction (`tx`) — so a caller inside `db.transaction()` can
 * have the notification row commit atomically with whatever else it's
 * writing (PHASE-7-9-RETROSPECTIVE.md §1). The paired email is sent
 * separately, via sendNotificationEmail, after the transaction commits —
 * an email must never roll back a transaction it isn't part of, and a
 * transaction must never block on an external network call.
 */
export async function writeNotification(dbClient: DbClient, input: NotifyInput): Promise<void> {
  await dbClient.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
    applicationId: input.applicationId,
  })
}

/**
 * Never throws — a failed send is logged, not propagated, so it's always
 * safe to call after a transaction has already committed (spec §25 wants
 * both channels, but the in-app row already landing is what matters most).
 */
export async function sendNotificationEmail(
  userId: string,
  email: { subject: string; text: string },
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true },
  })
  if (!user) return

  await sendEmail({ to: user.email, subject: email.subject, text: email.text }).catch((error) => {
    console.error('Failed to send notification email:', error)
  })
}

/**
 * Writes the in-app notification and sends the paired email in one call —
 * for callers not already inside a transaction. Callers wrapping a status
 * change in `db.transaction()` should call `writeNotification(tx, ...)`
 * inside it and `sendNotificationEmail(...)` after it resolves instead.
 */
export async function notify(input: NotifyInput): Promise<void> {
  await writeNotification(db, input)
  await sendNotificationEmail(input.userId, input.email)
}
