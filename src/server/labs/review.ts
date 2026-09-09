'use server'

import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { isExclusionViolation } from '@/server/db/errors'
import { auditLogs, labBookings } from '@/db/schema'
import { track } from '@/server/analytics/track'
import { requireUserOrThrow } from '@/server/auth/guards'
import { UnauthorizedError } from '@/server/auth/errors'
import { getSpaceById, listSpacesManagedBy } from '@/server/content/infrastructure'
import { labBookingDecisionTemplate } from '@/server/notifications/templates'
import { sendNotificationEmail, writeNotification } from '@/server/notifications/send'
import { canManageSpace } from './access'
import { formatCampusRange } from './hours'
import { isLegalTransition } from './transitions'

export type ActionResult = { ok: true } | { ok: false; error: string }
type Decision = 'approved' | 'rejected'

/**
 * Every space this person may decide for, plus the spaces a super admin sees.
 *
 * A super admin manages nothing by name, so listing spaces that name them would
 * return an empty queue for the one account that is supposed to be able to
 * unblock a lab whose manager has left.
 */
export async function listManagedSpaces() {
  const user = await requireUserOrThrow()
  if (user.staffRole === 'super_admin') {
    const { listBookableSpaces } = await import('@/server/content/infrastructure')
    return listBookableSpaces()
  }
  return listSpacesManagedBy(user.email ?? '')
}

/**
 * The manager's queue.
 *
 * Sorted by priority and then by when the slot is, not by when the request came
 * in: a founder at level 5 has `lab_priority`, which is a promise the ladder
 * makes and this is the only place it can be kept. Within a priority band the
 * soonest slot is the most urgent decision, because it is the one that expires.
 */
export async function listBookingsForManager(filters: { status?: string; labId?: number } = {}) {
  const spaces = await listManagedSpaces()
  const spaceIds = spaces.map((space) => space.id)
  if (spaceIds.length === 0) return { spaces, rows: [] }

  const scoped = filters.labId && spaceIds.includes(filters.labId) ? [filters.labId] : spaceIds

  const rows = await db.query.labBookings.findMany({
    where: and(
      inArray(labBookings.labId, scoped),
      filters.status ? eq(labBookings.status, filters.status as 'requested') : undefined,
      // Nothing is decided about the past. A queue that keeps showing last
      // month's requests is a queue people stop reading.
      filters.status === 'requested'
        ? gte(labBookings.endsAt, new Date())
        : undefined,
    ),
    with: { user: true },
    orderBy: [asc(labBookings.startsAt), desc(labBookings.createdAt)],
    limit: 200,
  })

  const byPriority = [...rows].sort((a, b) => {
    const aPriority = (a.user?.founderLevel ?? 1) >= 5 ? 0 : 1
    const bPriority = (b.user?.founderLevel ?? 1) >= 5 ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    return a.startsAt.getTime() - b.startsAt.getTime()
  })

  return { spaces, rows: byPriority }
}

export async function getBookingForManager(bookingId: string) {
  const user = await requireUserOrThrow()

  const booking = await db.query.labBookings.findFirst({
    where: eq(labBookings.id, bookingId),
    with: { user: true },
  })
  if (!booking) return null

  const space = await getSpaceById(booking.labId)
  if (!canManageSpace({ email: user.email, staffRole: user.staffRole }, space)) return null

  return { booking, space }
}

/**
 * The decision, and the only place a lab booking becomes a claim on a room.
 *
 * The interesting part is what is *not* here: no check for a conflicting
 * booking. `lab_bookings_no_overlap` — an `EXCLUDE USING gist` over
 * `(lab_id, tstzrange(starts_at, ends_at))` restricted to approved rows — is
 * the arbiter, and it is consulted by attempting the write. Reading first and
 * then writing is the shape that lets two managers approve two overlapping
 * requests in the same second, which is exactly the race
 * `src/server/events/actions.ts` has for event capacity.
 *
 * So the transaction is allowed to fail, SQLSTATE 23P01 is caught, and the
 * founder is told the truth: somebody got there first.
 */
export async function decideLabBooking(
  bookingId: string,
  decision: Decision,
  note?: string,
): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  const booking = await db.query.labBookings.findFirst({ where: eq(labBookings.id, bookingId) })
  if (!booking) return { ok: false, error: 'We couldn’t find that booking.' }

  const space = await getSpaceById(booking.labId)
  if (!canManageSpace({ email: user.email, staffRole: user.staffRole }, space)) {
    // Throws rather than returning, so the route handler answers 403 and not a
    // 200 carrying a refusal.
    throw new UnauthorizedError(403)
  }

  if (!isLegalTransition(booking.status, decision)) {
    return { ok: false, error: `Can’t move a booking from ${booking.status} to ${decision}.` }
  }

  const approved = decision === 'approved'
  const when = `${booking.startsAt.toDateString()}, ${formatCampusRange(booking.startsAt, booking.endsAt)}`
  const email = labBookingDecisionTemplate(approved, space?.name ?? 'the space', when, note?.trim() || null)

  const notifyInput = {
    userId: booking.userId,
    type: 'lab_booking_decision' as const,
    title: approved ? `${space?.name ?? 'Your booking'} is confirmed` : 'An update on your booking',
    body: note?.trim() || email.text,
    href: '/dashboard/labs',
    email,
  }

  const decidedAt = new Date()

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(labBookings)
        .set({
          status: decision,
          decidedByUserId: user.id,
          decidedAt,
          decisionNote: note?.trim() || null,
          updatedAt: decidedAt,
        })
        .where(and(eq(labBookings.id, bookingId), eq(labBookings.status, booking.status)))

      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        action: 'lab_booking_decided',
        entityType: 'lab_booking',
        entityId: bookingId,
        before: { status: booking.status },
        after: { status: decision, labId: booking.labId },
      })

      await writeNotification(tx, notifyInput)
    })
  } catch (error) {
    if (isExclusionViolation(error)) {
      return {
        ok: false,
        error: 'That slot was just taken — another booking for it was approved first.',
      }
    }
    throw error
  }

  await sendNotificationEmail(booking.userId, notifyInput.email)
  await track(
    'lab_booking_decided',
    { labId: booking.labId, approved },
    { userId: booking.userId },
  )

  return { ok: true }
}
