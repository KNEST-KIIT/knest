'use server'

import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { notifications } from '@/db/schema'
import { requireUserOrThrow } from '@/server/auth/guards'

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * The dashboard is the first UI in the app to read this table (PHASE-5-6-
 * RETROSPECTIVE.md §2 / §6 — notify() has written rows since Phase 6 with
 * nothing ever displaying them).
 */
export async function listNotificationsForUser(userId: string, limit = 10) {
  return db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit,
  })
}

export async function countUnread(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  return row?.value ?? 0
}

/** Ownership is checked server-side (spec §31) — the row ID alone is never trusted as proof of ownership. */
export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  const row = await db.query.notifications.findFirst({
    where: and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)),
    columns: { id: true },
  })
  if (!row) return { ok: false, error: 'Notification not found.' }

  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, notificationId))
  return { ok: true }
}
