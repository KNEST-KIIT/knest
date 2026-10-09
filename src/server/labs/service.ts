import { and, asc, count, desc, eq, gt, gte, inArray, lt } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db/client'
import { auditLogs, labAttendance, labBlackouts, labBookings, labHours, labs, labStaff, users } from '@/db/schema'
import { formatEventTime } from '@/lib/dates'
import { requireUserOrThrow } from '@/server/auth/guards'
import { isLabBookingEnabled } from '@/server/features'
import { sendNotificationEmail, writeNotification, type NotifyInput } from '@/server/notifications/send'
import {
  bookingAlternativeTemplate,
  bookingCancelledTemplate,
  bookingDecidedTemplate,
  bookingRequestedTemplate,
} from '@/server/notifications/templates'
import { actorFor, requireManager, requireStaffOfLab } from './access'
import {
  canTransition,
  generateSlots,
  LIVE_STATUSES,
  overlaps,
  problemWithRequest,
  weeklyHoursProblem,
  type BookingStatus,
  type LabBlackout,
  type LabHoursWindow,
  type LabPolicy,
} from './rules'

export type Lab = typeof labs.$inferSelect
export type Code = 'closed' | 'ineligible' | 'invalid' | 'limit' | 'conflict' | 'not-found' | 'state' | 'forbidden'
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; code: Code }

const fail = (error: string, code: Code): { ok: false; error: string; code: Code } => ({ ok: false, error, code })

export const policyOf = (lab: Lab): LabPolicy => ({
  slotMinutes: lab.slotMinutes,
  maxConsecutiveSlots: lab.maxConsecutiveSlots,
  minLeadMinutes: lab.minLeadMinutes,
  maxHorizonDays: lab.maxHorizonDays,
  capacity: lab.capacity,
})

/** PostgreSQL's "exclusion violation": the database refused an overlapping live booking. */
function isOverlapRefusal(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null
  return e?.code === '23P01' || e?.cause?.code === '23P01'
}

const CONFLICT_MESSAGE = 'Someone else just took that time. Pick another slot.'

/** A per-person limit was reached inside the transaction. */
class LimitError extends Error {}

// ------------------------------------------------------------------------------ reading

export async function listActiveLabs() {
  return db.select().from(labs).where(eq(labs.isActive, true)).orderBy(asc(labs.department), asc(labs.name))
}

export async function getLabBySlug(slug: string) {
  const lab = await db.query.labs.findFirst({ where: and(eq(labs.slug, slug), eq(labs.isActive, true)) })
  if (!lab) return null
  const [hours, blackouts] = await Promise.all([
    db.select().from(labHours).where(eq(labHours.labId, lab.id)).orderBy(asc(labHours.weekday), asc(labHours.opensMinute)),
    db.select().from(labBlackouts).where(eq(labBlackouts.labId, lab.id)).orderBy(asc(labBlackouts.startsOn)),
  ])
  return { lab, hours: hours as LabHoursWindow[] & { id: string }[], blackouts: blackouts as (LabBlackout & { id: string; reason: string })[] }
}

/** Free and busy slots on one IST date. No person is ever identified: only whether a slot is taken. */
export async function getAvailability(slug: string, date: string, now = new Date()) {
  const found = await getLabBySlug(slug)
  if (!found) return null
  const slots = generateSlots({ policy: policyOf(found.lab), hours: found.hours, blackouts: found.blackouts, date, now })
  if (slots.length === 0) return []
  const live = await db
    .select({ startsAt: labBookings.startsAt, endsAt: labBookings.endsAt })
    .from(labBookings)
    .where(and(eq(labBookings.labId, found.lab.id), inArray(labBookings.status, [...LIVE_STATUSES]), lt(labBookings.startsAt, slots[slots.length - 1]!.endsAt), gt(labBookings.endsAt, slots[0]!.startsAt)))
  return slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), free: !live.some((b) => overlaps(s, b)) }))
}

// ------------------------------------------------------------------------------ requesting

const requestSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  purpose: z.string().trim().min(5, 'Say briefly what you will do (at least a few words).').max(500, 'Keep the purpose under 500 characters.'),
  headcount: z.number().int().min(1).max(500),
  equipment: z.string().trim().max(300).optional().or(z.literal('')),
})

async function notifyMany(rows: NotifyInput[], dbClient: Parameters<typeof writeNotification>[0] = db) {
  for (const row of rows) await writeNotification(dbClient, row)
}
async function emailMany(rows: NotifyInput[]) {
  for (const row of rows) await sendNotificationEmail(row.userId, row.email)
}

async function headsOf(labId: string) {
  return db.select({ userId: labStaff.userId }).from(labStaff).where(and(eq(labStaff.labId, labId), eq(labStaff.role, 'head')))
}

/** A member asks to book a lab. Every rule is checked here, on the server; the database's exclusion constraint has the last word on overlap. */
export async function requestBooking(slug: string, input: unknown, now = new Date()): Promise<Result<{ id: string }>> {
  if (!isLabBookingEnabled()) return fail('Lab booking is not open yet.', 'closed')
  const sessionUser = await requireUserOrThrow()

  const found = await getLabBySlug(slug)
  if (!found) return fail('That lab doesn’t exist or isn’t taking bookings.', 'not-found')
  const { lab, hours, blackouts } = found

  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the booking details.', 'invalid')
  const data = parsed.data
  const startsAt = new Date(data.startsAt)
  const endsAt = new Date(data.endsAt)

  const person = await db.query.users.findFirst({ where: eq(users.id, sessionUser.id), columns: { emailVerified: true, onboardingCompletedAt: true, isActive: true, name: true, email: true } })
  if (!person?.isActive) return fail('Your account can’t make bookings.', 'ineligible')
  if (!person.emailVerified) return fail('Verify your email address before booking a lab.', 'ineligible')
  if (lab.eligibility === 'onboarded' && !person.onboardingCompletedAt) return fail('Finish setting up your profile before booking a lab.', 'ineligible')

  const problem = problemWithRequest({ policy: policyOf(lab), hours, blackouts, now, startsAt, endsAt, headcount: data.headcount })
  if (problem) return fail(problem, 'invalid')

  let created: { id: string; notices: NotifyInput[] }
  try {
    created = await db.transaction(async (tx) => {
      // One person's requests are checked and inserted one at a time, so two tabs cannot both slip under the limits.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, sessionUser.id)).for('update')

      const [open] = await tx
        .select({ value: count() })
        .from(labBookings)
        .where(and(eq(labBookings.userId, sessionUser.id), eq(labBookings.labId, lab.id), inArray(labBookings.status, ['requested', 'alternative_proposed'])))
      if ((open?.value ?? 0) >= lab.maxOpenRequests) throw new LimitError(`You already have ${lab.maxOpenRequests} requests waiting for this lab. Wait for a decision or cancel one.`)

      const mine = await tx
        .select({ startsAt: labBookings.startsAt, endsAt: labBookings.endsAt })
        .from(labBookings)
        .where(and(eq(labBookings.userId, sessionUser.id), eq(labBookings.labId, lab.id), inArray(labBookings.status, [...LIVE_STATUSES])))
      const weekly = weeklyHoursProblem({ existing: mine, request: { startsAt, endsAt }, maxHoursPerWeek: lab.maxHoursPerWeek })
      if (weekly) throw new LimitError(weekly)

      const [row] = await tx
        .insert(labBookings)
        .values({ labId: lab.id, userId: sessionUser.id, startsAt, endsAt, purpose: data.purpose, headcount: data.headcount, equipment: data.equipment || null })
        .returning({ id: labBookings.id })
      const heads = await tx.select({ userId: labStaff.userId }).from(labStaff).where(and(eq(labStaff.labId, lab.id), eq(labStaff.role, 'head')))
      const { subject, text } = bookingRequestedTemplate({
        lab: lab.name,
        who: person.name ?? person.email,
        when: `${formatEventTime(startsAt)} to ${formatEventTime(endsAt)}`,
        purpose: data.purpose,
        path: `/dashboard/lab-staff/${lab.slug}`,
      })
      const notices = heads.map((h) => ({ userId: h.userId, type: 'booking_requested' as const, title: subject, body: `${person.name ?? person.email}: ${formatEventTime(startsAt)}`, href: `/dashboard/lab-staff/${lab.slug}`, email: { subject, text } }))
      await notifyMany(notices, tx)
      return { id: row!.id, notices }
    })
  } catch (error) {
    if (error instanceof LimitError) return fail(error.message, 'limit')
    if (isOverlapRefusal(error)) return fail(CONFLICT_MESSAGE, 'conflict')
    throw error
  }
  // E-mails go out after the transaction has committed, never inside it.
  await emailMany(created.notices)
  return { ok: true, id: created.id }
}

// ------------------------------------------------------------------------------ deciding

export type Decision =
  | { action: 'approve'; assistantUserId?: string | null; note?: string | null }
  | { action: 'reject'; note: string }
  | { action: 'propose'; startsAt: string; endsAt: string; note?: string | null }

async function loadBooking(id: string) {
  const [row] = await db
    .select({ booking: labBookings, lab: labs, memberName: users.name, memberEmail: users.email })
    .from(labBookings)
    .innerJoin(labs, eq(labs.id, labBookings.labId))
    .innerJoin(users, eq(users.id, labBookings.userId))
    .where(eq(labBookings.id, id))
  return row ?? null
}

/** A lab head (or admin) decides a request: approve, reject with a reason, or propose another time. One transaction: the change, the audit row and the notice. */
export async function decideBooking(bookingId: string, decision: Decision, now = new Date()): Promise<Result> {
  const row = await loadBooking(bookingId)
  if (!row) return fail('That booking doesn’t exist.', 'not-found')
  const { booking, lab } = row
  const actor = await actorFor(lab.id)
  requireManager(actor)

  const when = `${formatEventTime(booking.startsAt)} to ${formatEventTime(booking.endsAt)}`
  const path = `/dashboard/lab-booking`
  let patch: Partial<typeof labBookings.$inferInsert>
  let target: BookingStatus
  let notice: NotifyInput

  if (decision.action === 'approve') {
    target = 'approved'
    if (booking.status !== 'requested') return fail('This request has already been decided.', 'state')
    if (lab.requiresAssistant && !decision.assistantUserId) return fail('This lab needs an assistant assigned before a booking is approved.', 'invalid')
    if (decision.assistantUserId) {
      const member = await db.query.labStaff.findFirst({ where: and(eq(labStaff.labId, lab.id), eq(labStaff.userId, decision.assistantUserId)), columns: { id: true } })
      if (!member) return fail('That person is not on this lab’s staff.', 'invalid')
    }
    patch = { status: target, assistantUserId: decision.assistantUserId ?? null, decisionNote: decision.note?.trim() || null }
    const t = bookingDecidedTemplate({ lab: lab.name, when, decision: 'approved', note: decision.note, path })
    notice = { userId: booking.userId, type: 'booking_decided', title: t.subject, body: when, href: path, email: t }
  } else if (decision.action === 'reject') {
    target = 'rejected'
    if (!canTransition(booking.status, target)) return fail('This request has already been decided.', 'state')
    const note = decision.note?.trim() ?? ''
    if (note.length < 3) return fail('Give a short reason so the person knows why.', 'invalid')
    patch = { status: target, decisionNote: note }
    const t = bookingDecidedTemplate({ lab: lab.name, when, decision: 'rejected', note, path })
    notice = { userId: booking.userId, type: 'booking_decided', title: t.subject, body: `${when}: ${note}`, href: path, email: t }
  } else {
    target = 'alternative_proposed'
    if (booking.status !== 'requested') return fail('This request has already been decided.', 'state')
    const found = await getLabBySlug(lab.slug)
    if (!found) return fail('That lab is not taking bookings.', 'not-found')
    const startsAt = new Date(decision.startsAt)
    const endsAt = new Date(decision.endsAt)
    const problem = problemWithRequest({ policy: policyOf(lab), hours: found.hours, blackouts: found.blackouts, now, startsAt, endsAt, headcount: booking.headcount })
    if (problem) return fail(`That alternative doesn’t work: ${problem}`, 'invalid')
    patch = { status: target, proposedStartsAt: startsAt, proposedEndsAt: endsAt, decisionNote: decision.note?.trim() || null }
    const t = bookingAlternativeTemplate({ lab: lab.name, original: when, proposed: `${formatEventTime(startsAt)} to ${formatEventTime(endsAt)}`, note: decision.note, path })
    notice = { userId: booking.userId, type: 'booking_alternative', title: t.subject, body: `Suggested: ${formatEventTime(startsAt)}`, href: path, email: t }
  }

  const done = await db.transaction(async (tx) => {
    const updated = await tx
      .update(labBookings)
      .set({ ...patch, decidedBy: actor.id, decidedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(labBookings.id, bookingId), eq(labBookings.status, booking.status)))
      .returning({ id: labBookings.id })
    if (updated.length === 0) return false
    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: `lab_booking_${decision.action === 'propose' ? 'alternative_proposed' : decision.action === 'approve' ? 'approved' : 'rejected'}`,
      entityType: 'lab_booking',
      entityId: bookingId,
      before: { status: booking.status },
      after: { status: target, ...(decision.action === 'propose' ? { proposedStartsAt: decision.startsAt, proposedEndsAt: decision.endsAt } : {}), ...(decision.action === 'approve' && decision.assistantUserId ? { assistantUserId: decision.assistantUserId } : {}) },
    })
    await writeNotification(tx, notice)
    return true
  })
  if (!done) return fail('Someone else decided this request first. Reload to see its current state.', 'state')
  await sendNotificationEmail(notice.userId, notice.email)
  return { ok: true }
}

// ------------------------------------------------------------------------------ the member's answer to a proposal

export async function respondToProposal(bookingId: string, accept: boolean, now = new Date()): Promise<Result> {
  const sessionUser = await requireUserOrThrow()
  const row = await loadBooking(bookingId)
  if (!row || row.booking.userId !== sessionUser.id) return fail('That booking doesn’t exist.', 'not-found')
  const { booking, lab } = row
  if (booking.status !== 'alternative_proposed' || !booking.proposedStartsAt || !booking.proposedEndsAt) return fail('There is no suggestion waiting for an answer.', 'state')
  if (accept && booking.proposedStartsAt.getTime() <= now.getTime()) return fail('That suggested time has passed.', 'state')

  try {
    const done = await db.transaction(async (tx) => {
      const updated = await tx
        .update(labBookings)
        .set(
          accept
            ? { status: 'approved', startsAt: booking.proposedStartsAt!, endsAt: booking.proposedEndsAt!, proposedStartsAt: null, proposedEndsAt: null, updatedAt: new Date() }
            : { status: 'cancelled', updatedAt: new Date() },
        )
        .where(and(eq(labBookings.id, bookingId), eq(labBookings.status, 'alternative_proposed')))
        .returning({ id: labBookings.id })
      if (updated.length === 0) return false
      const heads = await tx.select({ userId: labStaff.userId }).from(labStaff).where(and(eq(labStaff.labId, lab.id), eq(labStaff.role, 'head')))
      const t = bookingCancelledTemplate({ lab: lab.name, when: formatEventTime(booking.startsAt), by: row.memberName ?? row.memberEmail, note: 'They declined the suggested time.', path: `/dashboard/lab-staff/${lab.slug}` })
      if (!accept) await notifyMany(heads.map((h) => ({ userId: h.userId, type: 'booking_cancelled' as const, title: t.subject, body: `${row.memberName ?? row.memberEmail} declined the suggested time`, href: `/dashboard/lab-staff/${lab.slug}`, email: t })), tx)
      return true
    })
    if (!done) return fail('That suggestion was already answered.', 'state')
  } catch (error) {
    if (isOverlapRefusal(error)) return fail('That suggested time has been taken in the meantime. Ask the lab for another.', 'conflict')
    throw error
  }
  return { ok: true }
}

// ------------------------------------------------------------------------------ cancelling

export async function cancelBooking(bookingId: string, note?: string | null, now = new Date()): Promise<Result> {
  const row = await loadBooking(bookingId)
  if (!row) return fail('That booking doesn’t exist.', 'not-found')
  const { booking, lab } = row
  const actor = await actorFor(lab.id)
  const isBooker = booking.userId === actor.id
  const isManager = actor.isAdmin || actor.role === 'head'
  if (!isBooker && !isManager) return fail('That booking doesn’t exist.', 'not-found') // do not reveal it to anyone else
  if (!canTransition(booking.status, 'cancelled')) return fail('This booking can no longer be cancelled.', 'state')

  const trimmed = note?.trim() ?? ''
  if (!isBooker && trimmed.length < 3) return fail('Give a short reason so the person knows why.', 'invalid')
  if (isBooker && booking.status === 'approved' && booking.startsAt.getTime() - now.getTime() < lab.cancelCutoffMinutes * 60_000) {
    return fail(`Approved bookings can be cancelled up to ${lab.cancelCutoffMinutes / 60} hours before they start. Contact the lab to cancel now.`, 'state')
  }

  const when = formatEventTime(booking.startsAt)
  const byName = isBooker ? row.memberName ?? row.memberEmail : 'the lab'
  const heads = await headsOf(lab.id)
  const recipients = isBooker ? heads.map((h) => h.userId) : [booking.userId]
  const t = bookingCancelledTemplate({ lab: lab.name, when, by: byName, note: trimmed || null, path: isBooker ? `/dashboard/lab-staff/${lab.slug}` : '/dashboard/lab-booking' })
  const notices: NotifyInput[] = recipients.map((userId) => ({ userId, type: 'booking_cancelled', title: t.subject, body: `${when}${trimmed ? `: ${trimmed}` : ''}`, href: isBooker ? `/dashboard/lab-staff/${lab.slug}` : '/dashboard/lab-booking', email: t }))

  const done = await db.transaction(async (tx) => {
    const updated = await tx
      .update(labBookings)
      .set({ status: 'cancelled', decisionNote: isBooker ? booking.decisionNote : trimmed, updatedAt: new Date() })
      .where(and(eq(labBookings.id, bookingId), eq(labBookings.status, booking.status)))
      .returning({ id: labBookings.id })
    if (updated.length === 0) return false
    if (!isBooker) {
      await tx.insert(auditLogs).values({ actorUserId: actor.id, action: 'lab_booking_cancelled', entityType: 'lab_booking', entityId: bookingId, before: { status: booking.status }, after: { status: 'cancelled', note: trimmed } })
    }
    await notifyMany(notices, tx)
    return true
  })
  if (!done) return fail('This booking changed while you were looking at it. Reload to see its current state.', 'state')
  await emailMany(notices)
  return { ok: true }
}

// ------------------------------------------------------------------------------ attendance (manual)

export async function markAttendance(bookingId: string, outcome: 'attended' | 'no_show', reason?: string | null, now = new Date()): Promise<Result> {
  const row = await loadBooking(bookingId)
  if (!row) return fail('That booking doesn’t exist.', 'not-found')
  const { booking, lab } = row
  const actor = await actorFor(lab.id)
  requireStaffOfLab(actor)
  if (booking.status !== 'approved') return fail('Attendance can only be recorded for an approved booking that has not been closed.', 'state')
  if (booking.startsAt.getTime() > now.getTime()) return fail('That booking has not started yet.', 'state')
  const why = reason?.trim() ?? ''
  if (outcome === 'no_show' && why.length < 3) return fail('Give a short reason for a no-show.', 'invalid')

  const target: BookingStatus = outcome === 'attended' ? 'completed' : 'no_show'
  const done = await db.transaction(async (tx) => {
    const updated = await tx
      .update(labBookings)
      .set({ status: target, updatedAt: new Date() })
      .where(and(eq(labBookings.id, bookingId), eq(labBookings.status, 'approved')))
      .returning({ id: labBookings.id })
    if (updated.length === 0) return false
    await tx.insert(labAttendance).values({ bookingId, outcome, markedBy: actor.id, reason: why || null, method: 'manual' })
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: `lab_attendance_${outcome}`, entityType: 'lab_booking', entityId: bookingId, before: { status: 'approved' }, after: { status: target, method: 'manual', reason: why || null } })
    return true
  })
  if (!done) return fail('Attendance was already recorded for this booking.', 'state')
  return { ok: true }
}

// ------------------------------------------------------------------------------ lists for the screens

export async function listMyBookings(userId: string) {
  return db
    .select({ booking: labBookings, labName: labs.name, labSlug: labs.slug, cutoff: labs.cancelCutoffMinutes })
    .from(labBookings)
    .innerJoin(labs, eq(labs.id, labBookings.labId))
    .where(eq(labBookings.userId, userId))
    .orderBy(desc(labBookings.startsAt))
    .limit(100)
}

/** Bookings for one lab, with the booker's name and email, for its head, assistants and admins only (the caller has checked). */
export async function listLabBookings(labId: string, scope: 'open' | 'upcoming' | 'past') {
  const now = new Date()
  const where =
    scope === 'open'
      ? and(eq(labBookings.labId, labId), inArray(labBookings.status, ['requested', 'alternative_proposed']))
      : scope === 'upcoming'
        ? and(eq(labBookings.labId, labId), eq(labBookings.status, 'approved'), gte(labBookings.endsAt, now))
        : and(eq(labBookings.labId, labId), inArray(labBookings.status, ['approved', 'completed', 'no_show', 'rejected', 'cancelled']), lt(labBookings.endsAt, now))
  return db
    .select({ booking: labBookings, memberName: users.name, memberEmail: users.email })
    .from(labBookings)
    .innerJoin(users, eq(users.id, labBookings.userId))
    .where(where)
    .orderBy(scope === 'past' ? desc(labBookings.startsAt) : asc(labBookings.startsAt))
    .limit(200)
}

/** An assistant's own upcoming duties, across the labs they staff. */
export async function listRoster(userId: string) {
  return db
    .select({ booking: labBookings, labName: labs.name, labSlug: labs.slug, memberName: users.name })
    .from(labBookings)
    .innerJoin(labs, eq(labs.id, labBookings.labId))
    .innerJoin(users, eq(users.id, labBookings.userId))
    .where(and(eq(labBookings.assistantUserId, userId), eq(labBookings.status, 'approved'), gte(labBookings.endsAt, new Date())))
    .orderBy(asc(labBookings.startsAt))
}

export async function listLabStaff(labId: string) {
  return db
    .select({ id: labStaff.id, userId: labStaff.userId, role: labStaff.role, name: users.name, email: users.email })
    .from(labStaff)
    .innerJoin(users, eq(users.id, labStaff.userId))
    .where(eq(labStaff.labId, labId))
    .orderBy(asc(labStaff.role), asc(users.email))
}

