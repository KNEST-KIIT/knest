import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLogs, enquiries } from '@/db/schema'
import { requireStaffOrThrow } from '@/server/auth/guards'
import { sendEmail } from '@/server/email/send'
import { enquirySchema } from './validation'

export type SubmitResult = { ok: true } | { ok: false; error: string }

/**
 * Stores a contact-form message. A filled honeypot is reported as success and stored nowhere, so a
 * bot learns nothing. The optional staff notification never blocks or fails the submission: the
 * message is already safely stored when it is sent.
 */
export async function submitEnquiry(input: unknown, context: { userId?: string | null }): Promise<SubmitResult> {
  const parsed = enquirySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your message and try again.' }
  const { website, ...data } = parsed.data
  if (website) return { ok: true }

  const [row] = await db
    .insert(enquiries)
    .values({ ...data, topic: data.topic as never, userId: context.userId ?? null })
    .returning({ id: enquiries.id })

  const notifyTo = process.env.ENQUIRY_NOTIFY_EMAIL
  if (notifyTo && row) {
    await sendEmail({
      to: notifyTo,
      subject: `New KNEST enquiry (${data.topic})`,
      text: `A message arrived through the contact form.\n\nFrom: ${data.name} <${data.email}>\nTopic: ${data.topic}\n\n${data.message}\n\nReference: ${row.id}`,
    }).catch((error) => console.error('Failed to send enquiry notification:', error))
  }
  return { ok: true }
}

export const ENQUIRIES_PAGE_SIZE = 25

/** Staff list, newest first, optionally only the open ones. Requires the `users` area (super admin) or content admin. */
export async function listEnquiries(options: { status?: 'new' | 'handled'; page?: number } = {}) {
  await requireStaffOrThrow('enquiries')
  const page = Math.max(1, options.page ?? 1)
  const where = options.status ? eq(enquiries.status, options.status) : undefined
  const [rows, [total]] = await Promise.all([
    db.select().from(enquiries).where(where).orderBy(desc(enquiries.createdAt)).limit(ENQUIRIES_PAGE_SIZE).offset((page - 1) * ENQUIRIES_PAGE_SIZE),
    db.select({ value: sql<number>`count(*)::int` }).from(enquiries).where(where),
  ])
  return { rows, total: total?.value ?? 0, page, pageSize: ENQUIRIES_PAGE_SIZE }
}

/** Marks one enquiry handled, with an audit row, in one transaction. Idempotent: a second call changes nothing. */
export async function markEnquiryHandled(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const staff = await requireStaffOrThrow('enquiries')
  const changed = await db.transaction(async (tx) => {
    const updated = await tx
      .update(enquiries)
      .set({ status: 'handled', handledAt: new Date(), handledBy: staff.id })
      .where(and(eq(enquiries.id, id), eq(enquiries.status, 'new')))
      .returning({ id: enquiries.id })
    if (updated.length === 0) return false
    await tx.insert(auditLogs).values({
      actorUserId: staff.id,
      action: 'enquiry_handled',
      entityType: 'enquiry',
      entityId: id,
      before: { status: 'new' },
      after: { status: 'handled' },
    })
    return true
  })
  if (!changed) {
    const exists = await db.query.enquiries.findFirst({ where: eq(enquiries.id, id), columns: { id: true } })
    return exists ? { ok: true } : { ok: false, error: 'That enquiry doesn’t exist.' }
  }
  return { ok: true }
}
