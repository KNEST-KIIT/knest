'use server'

import { and, desc, eq, gt, inArray, lt } from 'drizzle-orm'
import { db } from '@/db/client'
import { labBookings, users } from '@/db/schema'
import { track } from '@/server/analytics/track'
import { requireUserOrThrow } from '@/server/auth/guards'
import { getSpaceById } from '@/server/content/infrastructure'
import { hasCapability, requireCapability } from '@/server/founders/levels'
import { sendEmail } from '@/server/email/send'
import { labBookingRequestedTemplate } from '@/server/notifications/templates'
import { writeNotification } from '@/server/notifications/send'
import { RATE_LIMITS, enforceRateLimit } from '@/server/security/rate-limit'
import { canManageSpace, managerEmails } from './access'
import { campusMoment, formatCampusRange, slotsForDay } from './hours'
import { isLegalTransition } from './transitions'

export type ActionResult = { ok: true } | { ok: false; error: string }

const MIN_PURPOSE = 20
const MAX_PURPOSE = 1000

/**
 * How many standard slots a founder with `lab_extended_slots` may take at once.
 *
 * Not unlimited: the capability is meant to let someone building hardware run
 * a long session, not to let one account hold a room for a whole week. Four
 * hours of a 60-minute-slot lab is a long afternoon, and anything past that is
 * a conversation with the lab rather than a form.
 */
const MAX_EXTENDED_SLOTS = 4

/**
 * A founder asking a KIIT school for time in their lab.
 *
 * The insert is deliberately cheap — every check here is about whether the ask
 * is coherent, not about whether the room is free. Two founders may ask for the
 * same slot; the clash is settled at the moment a manager approves one, by the
 * `lab_bookings_no_overlap` exclusion constraint. Checking availability here
 * and trusting it would be the same read-then-write race that
 * `src/server/events/actions.ts` has for capacity, where two concurrent
 * registrations at the boundary both succeed.
 */
export async function requestLabBooking(input: {
  labId: number
  /** ISO instant for the start of a slot the space actually offers. */
  startsAt: string
  /** Standard slots to take. More than one needs `lab_extended_slots`. */
  slots?: number
  purpose: string
}): Promise<{ ok: true; bookingId: string } | { ok: false; error: string }> {
  const user = await requireUserOrThrow()
  await enforceRateLimit(`lab-booking:${user.id}`, RATE_LIMITS.labBooking)

  const purpose = input.purpose?.trim() ?? ''
  if (purpose.length < MIN_PURPOSE) {
    return { ok: false, error: 'Say what you need the space for — a sentence is enough.' }
  }
  if (purpose.length > MAX_PURPOSE) {
    return { ok: false, error: 'Keep it under 1000 characters.' }
  }

  const labId = Math.trunc(Number(input.labId))
  const space = await getSpaceById(labId)
  if (!space) return { ok: false, error: 'We couldn’t find that space.' }
  if (!space.bookable) return { ok: false, error: 'That space isn’t taking bookings.' }

  // The level is read from the database, not the session: this is a write, and
  // it should be decided on what is true now rather than on what was true when
  // the session row was last refreshed.
  const row = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { founderLevel: true },
  })
  const level = row?.founderLevel ?? 1

  // Throws CapabilityError, which carries the level needed so the API can say
  // "book_lab unlocks at level 3" rather than "Not permitted."
  requireCapability(level, 'book_lab')

  // Then the space's own bar, which may be higher than the platform's. A wet
  // lab and a co-working desk are not the same risk, and the school that owns
  // the room gets to say so.
  const minimumLevel = space.minimumLevel ?? 3
  if (level < minimumLevel) {
    return {
      ok: false,
      error: `${space.name} is open to founders at level ${minimumLevel} and above. You’re at level ${level}.`,
    }
  }

  const startsAt = new Date(input.startsAt)
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: 'That isn’t a time we can read.' }

  const requestedSlots = Math.trunc(Number(input.slots ?? 1)) || 1
  if (requestedSlots < 1) return { ok: false, error: 'Book at least one slot.' }
  if (requestedSlots > 1 && !hasCapability(level, 'lab_extended_slots')) {
    return {
      ok: false,
      error: 'Longer sessions unlock at level 4 (MVP). For now, book one slot at a time.',
    }
  }
  if (requestedSlots > MAX_EXTENDED_SLOTS) {
    return {
      ok: false,
      error: `You can hold ${MAX_EXTENDED_SLOTS} slots in one booking. For longer, talk to the lab directly.`,
    }
  }

  if (startsAt.getTime() <= Date.now()) {
    return { ok: false, error: 'That slot has already started.' }
  }
  const maxAdvanceDays = space.maxAdvanceDays ?? 30
  const horizon = Date.now() + maxAdvanceDays * 24 * 60 * 60 * 1000
  if (startsAt.getTime() > horizon) {
    return { ok: false, error: `${space.name} takes bookings up to ${maxAdvanceDays} days ahead.` }
  }

  // Validate against the slots the space actually offers rather than
  // re-deriving the rules here. That way "is it open then", "does it start on
  // a boundary" and "does it fit before closing" are one question with one
  // answer, and the answer is the same one the picker showed.
  const slotMinutes = space.slotMinutes ?? 60
  const day = campusMoment(startsAt)
  const offered = slotsForDay(space.openHours, slotMinutes, day.year, day.month, day.day)
  const startIndex = offered.findIndex((slot) => slot.startsAt.getTime() === startsAt.getTime())
  if (startIndex === -1) {
    return { ok: false, error: `${space.name} isn’t open then.` }
  }

  // Consecutive slots only: an extended booking is a longer session, not a
  // basket of scattered ones. `slotsForDay` already excludes the gap between
  // two open windows, so a run that spans a lunch break fails here.
  const lastIndex = startIndex + requestedSlots - 1
  const last = offered[lastIndex]
  if (!last) return { ok: false, error: `${space.name} isn’t open that long.` }
  const contiguous = offered
    .slice(startIndex, lastIndex + 1)
    .every((slot, index, all) => index === 0 || slot.startsAt.getTime() === all[index - 1]!.endsAt.getTime())
  if (!contiguous) return { ok: false, error: `${space.name} closes partway through that.` }

  const endsAt = last.endsAt

  // One open ask per person per slot. Not a unique index, because "overlapping"
  // is not something a unique index expresses and the exclusion constraint
  // deliberately only covers approved rows; this is a courtesy check that stops
  // a double-submit, not a correctness boundary.
  const existing = await db.query.labBookings.findFirst({
    where: and(
      eq(labBookings.userId, user.id),
      eq(labBookings.labId, labId),
      inArray(labBookings.status, ['requested', 'approved']),
      lt(labBookings.startsAt, endsAt),
      gt(labBookings.endsAt, startsAt),
    ),
  })
  if (existing) {
    return { ok: false, error: 'You’ve already asked for that time. We’ll come back to you on it.' }
  }

  const [created] = await db
    .insert(labBookings)
    .values({ userId: user.id, labId, startsAt, endsAt, purpose })
    .returning({ id: labBookings.id })
  if (!created) return { ok: false, error: 'We couldn’t save that. Try again.' }

  await notifyManagers(space, user.name ?? user.email ?? 'A founder', startsAt, endsAt)
  await track('lab_booking_requested', { labId, slots: requestedSlots }, { userId: user.id })

  return { ok: true, bookingId: created.id }
}

/**
 * Tell the space's managers there is something waiting.
 *
 * By email first, and only by email for most of them: a lab manager is a
 * professor in another school who may well have no KNEST account, and
 * `notifications.userId` is a foreign key to `app.users`. So the in-app row is
 * written for the managers who do have accounts, and everyone on the list gets
 * the mail either way. Failures are swallowed — a booking that saved must not
 * be reported as failed because an SMTP host was down.
 */
async function notifyManagers(
  space: { id: number; name: string; managers?: { email: string }[] | null },
  founderName: string,
  startsAt: Date,
  endsAt: Date,
): Promise<void> {
  const emails = managerEmails(space)
  if (emails.length === 0) return

  const when = `${startsAt.toDateString()}, ${formatCampusRange(startsAt, endsAt)}`
  const email = labBookingRequestedTemplate(space.name, founderName, when)

  const managerAccounts = await db.query.users.findMany({
    where: inArray(users.email, emails),
    columns: { id: true },
  })

  await Promise.all([
    ...managerAccounts.map((account) =>
      writeNotification(db, {
        userId: account.id,
        type: 'lab_booking_received',
        title: `A request for ${space.name}`,
        body: `${founderName} has asked for ${when}.`,
        href: '/dashboard/labs/manage',
        email,
      }).catch((error) => console.error('Failed to write manager notification:', error)),
    ),
    ...emails.map((to) =>
      sendEmail({ to, subject: email.subject, text: email.text }).catch((error) =>
        console.error('Failed to email lab manager:', error),
      ),
    ),
  ])
}

/**
 * Giving a slot back.
 *
 * Open to the founder who holds it and to the space's managers, and to nobody
 * else — a booking id is not proof of anything, so the founder's path is scoped
 * by `userId` in the query and the manager's is checked against that space's
 * own manager list.
 */
export async function cancelLabBooking(bookingId: string, reason?: string): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  const booking = await db.query.labBookings.findFirst({ where: eq(labBookings.id, bookingId) })
  if (!booking) return { ok: false, error: 'We couldn’t find that booking.' }

  const isOwner = booking.userId === user.id
  if (!isOwner) {
    const space = await getSpaceById(booking.labId)
    if (!canManageSpace({ email: user.email, staffRole: user.staffRole }, space)) {
      // Reads as missing rather than as forbidden: whether a given booking id
      // exists is not something a stranger should learn.
      return { ok: false, error: 'We couldn’t find that booking.' }
    }
  }

  if (!isLegalTransition(booking.status, 'cancelled')) {
    return { ok: false, error: 'That booking can’t be cancelled.' }
  }

  await db
    .update(labBookings)
    .set({
      status: 'cancelled',
      decisionNote: reason?.trim() || booking.decisionNote,
      updatedAt: new Date(),
    })
    .where(eq(labBookings.id, bookingId))

  return { ok: true }
}

export async function listBookingsForUser(userId: string) {
  return db.query.labBookings.findMany({
    where: eq(labBookings.userId, userId),
    orderBy: [desc(labBookings.startsAt)],
    limit: 50,
  })
}

/**
 * The slots already spoken for on one campus day, so the picker can grey them
 * out. Advisory only — the constraint is what actually decides.
 */
export async function listHeldSlots(labId: number, from: Date, to: Date) {
  return db.query.labBookings.findMany({
    where: and(
      eq(labBookings.labId, labId),
      eq(labBookings.status, 'approved'),
      lt(labBookings.startsAt, to),
      gt(labBookings.endsAt, from),
    ),
    columns: { startsAt: true, endsAt: true },
  })
}
