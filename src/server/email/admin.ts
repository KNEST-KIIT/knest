import 'server-only'

import { count, desc, inArray, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { emailOutbox } from '@/db/schema'
import { requireStaffOrThrow } from '@/server/auth/guards'
import { requeue, type RequeueResult } from './outbox'

export const MAIL_PAGE_SIZE = 25

export type MailFilter = 'attention' | 'pending' | 'sent' | 'all'

/** Statuses a filter shows. "attention" is the operator's working list: mail that did not go. */
const FILTER_STATUSES: Record<Exclude<MailFilter, 'all'>, ('pending' | 'sent' | 'expired' | 'dead')[]> = {
  attention: ['dead', 'expired'],
  pending: ['pending'],
  sent: ['sent'],
}

/**
 * Outgoing mail for operators (super admin). The body is never returned: the list shows who it
 * was for, what it was, how many attempts were made and why the last one failed.
 */
export async function listOutbox(options: { filter?: MailFilter; page?: number } = {}) {
  await requireStaffOrThrow('mail')
  const filter = options.filter ?? 'attention'
  const page = Math.max(1, options.page ?? 1)
  const where = filter === 'all' ? undefined : inArray(emailOutbox.status, FILTER_STATUSES[filter])

  const [rows, [total], statusCounts] = await Promise.all([
    db
      .select({
        id: emailOutbox.id,
        toAddress: emailOutbox.toAddress,
        subject: emailOutbox.subject,
        status: emailOutbox.status,
        attempts: emailOutbox.attempts,
        lastError: emailOutbox.lastError,
        createdAt: emailOutbox.createdAt,
        sentAt: emailOutbox.sentAt,
        resendable: sql<boolean>`(${emailOutbox.status} in ('dead','expired') and ${emailOutbox.body} <> '')`,
      })
      .from(emailOutbox)
      .where(where)
      .orderBy(desc(emailOutbox.createdAt))
      .limit(MAIL_PAGE_SIZE)
      .offset((page - 1) * MAIL_PAGE_SIZE),
    db.select({ value: count() }).from(emailOutbox).where(where),
    db.select({ status: emailOutbox.status, value: count() }).from(emailOutbox).groupBy(emailOutbox.status),
  ])

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.value])) as Record<string, number | undefined>
  return { rows, total: total?.value ?? 0, page, pageSize: MAIL_PAGE_SIZE, filter, byStatus }
}

export type ResendOutcome = { ok: true } | { ok: false; error: string; status: number }

const RESEND_MESSAGES: Record<Exclude<RequeueResult, 'queued'>, { error: string; status: number }> = {
  not_found: { error: 'That message no longer exists.', status: 404 },
  not_resendable: { error: 'Only mail that did not go out can be resent.', status: 409 },
  no_body: {
    error: 'This message’s content has been removed, so it cannot be resent. Ask the person to request a new link.',
    status: 409,
  },
}

export async function resendOutboxMessage(id: string): Promise<ResendOutcome> {
  const staff = await requireStaffOrThrow('mail')
  const result = await requeue(id, staff.id)
  if (result === 'queued') return { ok: true }
  return { ok: false, ...RESEND_MESSAGES[result] }
}
