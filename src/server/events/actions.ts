'use server'

import { and, count, desc, eq } from 'drizzle-orm'
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

  if (event.capacity) {
    const [row] = await db
      .select({ value: count() })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId))
    const registeredCount = row?.value ?? 0

    const alreadyRegistered = await db.query.eventRegistrations.findFirst({
      where: and(eq(eventRegistrations.userId, user.id), eq(eventRegistrations.eventId, eventId)),
    })

    if (!alreadyRegistered && registeredCount >= event.capacity) {
      return { ok: false, error: 'This event is full.' }
    }
  }

  await db
    .insert(eventRegistrations)
    .values({ userId: user.id, eventId })
    .onConflictDoNothing()

  await track('event_register', { eventId })

  return { ok: true }
}

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

