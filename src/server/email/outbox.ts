import { and, eq, inArray, lte, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { emailOutbox } from '@/db/schema'
import { sendEmailDirect } from './send'

/**
 * Durable delivery for outgoing mail (see src/db/schema/email-outbox.ts).
 *
 * Lifecycle of a row: pending -> sent | expired | dead. `pending` rows are claimed with a lease
 * (their next_attempt_at is pushed out before sending), so two workers, or a worker and the
 * request that created the row, never send the same message at once.
 */

export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000
export const MAX_ATTEMPTS = 8
const LEASE_MS = 2 * 60 * 1000
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000, 6 * 60 * 60_000, 12 * 60 * 60_000]

/** Delay before the next attempt, given how many attempts have already failed (1 = the first failure). */
export function backoffMs(failedAttempts: number): number {
  return BACKOFF_MS[Math.min(Math.max(failedAttempts, 1), BACKOFF_MS.length) - 1]!
}

/** Bounded, single-line, with no address list: provider messages can echo recipients. */
export function describeError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return raw.replace(/\s+/g, ' ').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<address>').slice(0, 300)
}

type Message = { to: string; subject: string; text: string }

async function attempt(id: string, message: Message): Promise<'sent' | 'retry' | 'dead'> {
  try {
    await sendEmailDirect(message)
    await db.update(emailOutbox).set({ status: 'sent', sentAt: new Date(), body: '', lastError: null }).where(eq(emailOutbox.id, id))
    return 'sent'
  } catch (error) {
    const description = describeError(error)
    const [row] = await db
      .update(emailOutbox)
      .set({ attempts: sql`${emailOutbox.attempts} + 1`, lastError: description })
      .where(eq(emailOutbox.id, id))
      .returning({ attempts: emailOutbox.attempts, expiresAt: emailOutbox.expiresAt })
    const failed = row?.attempts ?? 1
    const expired = row ? row.expiresAt.getTime() <= Date.now() : false
    if (failed >= MAX_ATTEMPTS || expired) {
      await db.update(emailOutbox).set({ status: expired ? 'expired' : 'dead', body: '' }).where(eq(emailOutbox.id, id))
      console.error(`email_outbox_dead id=${id} attempts=${failed} reason=${expired ? 'expired' : 'attempts'} error=${description}`)
      return 'dead'
    }
    await db
      .update(emailOutbox)
      .set({ nextAttemptAt: new Date(Date.now() + backoffMs(failed)) })
      .where(eq(emailOutbox.id, id))
    console.error(`email_outbox_retry id=${id} attempts=${failed} error=${description}`)
    return 'retry'
  }
}

/** Stores the message, then makes the first attempt. Never throws once the row is stored. */
export async function sendDurably(message: Message, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  let id: string
  try {
    const [row] = await db
      .insert(emailOutbox)
      .values({
        toAddress: message.to,
        subject: message.subject,
        body: message.text,
        // Leased for the immediate attempt below.
        nextAttemptAt: new Date(Date.now() + LEASE_MS),
        expiresAt: new Date(Date.now() + ttlMs),
      })
      .returning({ id: emailOutbox.id })
    id = row!.id
  } catch (error) {
    console.error('email_outbox_unavailable', describeError(error))
    await sendEmailDirect(message)
    return
  }
  await attempt(id, message)
}

/** Sends every message that is due. Returns how many were attempted. Safe to call from several processes. */
export async function processDue(limit = 20): Promise<number> {
  const claimed = await db.transaction(async (tx) => {
    const due = await tx
      .select({ id: emailOutbox.id })
      .from(emailOutbox)
      .where(and(eq(emailOutbox.status, 'pending'), lte(emailOutbox.nextAttemptAt, new Date())))
      .orderBy(emailOutbox.nextAttemptAt)
      .limit(limit)
      .for('update', { skipLocked: true })
    if (due.length === 0) return []
    return tx
      .update(emailOutbox)
      .set({ nextAttemptAt: new Date(Date.now() + LEASE_MS) })
      .where(inArray(emailOutbox.id, due.map((r) => r.id)))
      .returning({ id: emailOutbox.id, to: emailOutbox.toAddress, subject: emailOutbox.subject, text: emailOutbox.body, expiresAt: emailOutbox.expiresAt })
  })
  for (const row of claimed) {
    if (row.expiresAt.getTime() <= Date.now()) {
      await db.update(emailOutbox).set({ status: 'expired', body: '' }).where(eq(emailOutbox.id, row.id))
      console.error(`email_outbox_dead id=${row.id} reason=expired`)
      continue
    }
    await attempt(row.id, { to: row.to, subject: row.subject, text: row.text })
  }
  return claimed.length
}

let timer: ReturnType<typeof setInterval> | undefined

/** Starts the retry loop for this process (idempotent). */
export function startOutboxWorker(intervalMs = 30_000): void {
  if (timer) return
  let running = false
  timer = setInterval(() => {
    if (running) return
    running = true
    processDue()
      .catch((error) => console.error('email_outbox_worker', describeError(error)))
      .finally(() => {
        running = false
      })
  }, intervalMs)
  timer.unref?.()
}
