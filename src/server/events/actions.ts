'use server'

import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { eventRegistrations } from '@/db/schema'
import { requireUserOrThrow } from '@/server/auth/guards'
import { getEventById } from '@/server/content/events'
import { track } from '@/server/analytics/track'

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Idempotent by construction, not by check-then-insert: PHASE-5-6-
 * RETROSPECTIVE.md §4 found startApplication racing on a check-then-insert
 * idempotency pattern (two concurrent requests can both pass the check
 * before either inserts, and the second hits the unique index as an
 * uncaught Postgres error). This uses onConflictDoNothing() so the unique
 * index enforces idempotency directly — a duplicate registration attempt is
 * a silent no-op, never a race.
 */
export async function registerForEvent(eventId: number): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  const event = await getEventById(eventId)
  if (!event) return { ok: false, error: 'That event doesn’t exist.' }

  // An event that registers elsewhere is not ours to count, and a finished
  // event cannot be joined.
  if (event.registrationUrl) {
    return { ok: false, error: 'Registration for this event happens on the organiser’s page.' }
  }
  const endsAt = new Date(event.endsAt ?? event.startsAt)
  if (endsAt.getTime() < Date.now()) return { ok: false, error: 'This event has already taken place.' }

  // The capacity check and the insert run under a per-event advisory lock held
  // to the end of the transaction. Counting first and inserting afterwards let N
  // simultaneous requests all see "one seat left" and all take it (R-05).
  const outcome = await db.transaction(async (tx) => {
    if (event.capacity) {
      await tx.execute(sql`select pg_advisory_xact_lock(${EVENT_LOCK_NAMESPACE}, ${eventId})`)
      const [row] = await tx
        .select({ value: count() })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventId, eventId))
      const alreadyRegistered = await tx.query.eventRegistrations.findFirst({
        where: and(eq(eventRegistrations.userId, user.id), eq(eventRegistrations.eventId, eventId)),
      })
      if (!alreadyRegistered && (row?.value ?? 0) >= event.capacity) return 'full' as const
    }
    await tx.insert(eventRegistrations).values({ userId: user.id, eventId }).onConflictDoNothing()
    return 'registered' as const
  })
  if (outcome === 'full') return { ok: false, error: 'This event is full.' }

  await track('event_register', { eventId })

  return { ok: true }
}

/** Namespace for the two-key advisory lock, so event ids never collide with other advisory locks. */
const EVENT_LOCK_NAMESPACE = 7101

export async function unregisterFromEvent(eventId: number): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  await db
    .delete(eventRegistrations)
    .where(and(eq(eventRegistrations.userId, user.id), eq(eventRegistrations.eventId, eventId)))

  return { ok: true }
}

export async function getRegistrationStatus(userId: string, eventId: number): Promise<boolean> {
  const existing = await db.query.eventRegistrations.findFirst({
    where: and(eq(eventRegistrations.userId, userId), eq(eventRegistrations.eventId, eventId)),
  })
  return Boolean(existing)
}

export async function getRegistrationCount(eventId: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, eventId))
  return row?.value ?? 0
}

export async function listRegisteredEventsForUser(userId: string) {
  const rows = await db.query.eventRegistrations.findMany({
    where: eq(eventRegistrations.userId, userId),
    orderBy: [desc(eventRegistrations.registeredAt)],
  })

  return Promise.all(
    rows.map(async (row) => ({
      registration: row,
      event: await getEventById(row.eventId),
    })),
  )
}

