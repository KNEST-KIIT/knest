import { db } from '@/db/client'
import { notifications, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from '@/server/email/send'
import type { notificationType } from '@/db/schema'

/**
 * Writes the in-app notification and sends the paired email in one call —
 * spec §25 requires both channels for application status changes, and a
 * single entry point means a caller can't accidentally do one without the
 * other.
 */
export async function notify(input: {
  userId: string
  type: (typeof notificationType.enumValues)[number]
  title: string
  body: string
  href?: string
  applicationId?: string
  email: { subject: string; text: string }
}): Promise<void> {
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
    applicationId: input.applicationId,
  })

  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
    columns: { email: true },
  })
  if (!user) return

  await sendEmail({ to: user.email, subject: input.email.subject, text: input.email.text }).catch(
    (error) => {
      // The in-app notification already landed; losing the email is worth
      // logging but must not fail the request that triggered it (e.g. a
      // status change a staff member just made).
      console.error('Failed to send notification email:', error)
    },
  )
}
