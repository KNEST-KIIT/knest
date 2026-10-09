/**
 * Lab booking rules, as pure functions of data: no database, no clock of their own. Every policy
 * value comes in as an argument (they are settings on the lab, not constants here), so the
 * recommended defaults can change without a code change and the rules can be tested exhaustively.
 *
 * All wall-clock reasoning is in India Standard Time (UTC+5:30, no daylight saving), the zone the
 * labs operate in, whatever the server's own clock is set to.
 */

export const IST_OFFSET_MINUTES = 330
const MS = { minute: 60_000, day: 86_400_000 }

export type LabPolicy = {
  slotMinutes: number
  maxConsecutiveSlots: number
  minLeadMinutes: number
  maxHorizonDays: number
  capacity: number
}
export type LabHoursWindow = { weekday: number; opensMinute: number; closesMinute: number }
export type LabBlackout = { startsOn: string; endsOn: string }
export type Slot = { startsAt: Date; endsAt: Date }

// ----------------------------------------------------------------------------- India time

/** The IST calendar date ("2026-10-12"), weekday (0 = Sunday) and minutes after midnight of an instant. */
export function istParts(instant: Date): { date: string; weekday: number; minuteOfDay: number } {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MINUTES * MS.minute)
  return {
    date: shifted.toISOString().slice(0, 10),
    weekday: shifted.getUTCDay(),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

/** The instant at which an IST calendar date starts plus `minute` minutes. */
export function istInstant(date: string, minute = 0): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!) + minute * MS.minute - IST_OFFSET_MINUTES * MS.minute)
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const probe = new Date(Date.UTC(y!, m! - 1, d!))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m! - 1 && probe.getUTCDate() === d
}

/** The Monday (IST) that starts the week containing the instant, as a date string. Weeks run Monday to Sunday. */
export function istWeekStart(instant: Date): string {
  const { date, weekday } = istParts(instant)
  const back = (weekday + 6) % 7
  return istParts(new Date(istInstant(date).getTime() - back * MS.day)).date
}

export const isBlackedOut = (date: string, blackouts: LabBlackout[]) => blackouts.some((b) => date >= b.startsOn && date <= b.endsOn)

// ----------------------------------------------------------------------------- slots

/**
 * The bookable slots on one IST date: each operating window is cut into back-to-back slots of
 * `slotMinutes` from its opening time; a slot that does not fit entirely inside the window is not
 * offered. Nothing is offered on a blackout date, before now + the minimum lead time, or beyond the
 * booking horizon. (Slots already taken are removed by the caller, which has the bookings.)
 */
export function generateSlots(input: { policy: LabPolicy; hours: LabHoursWindow[]; blackouts: LabBlackout[]; date: string; now: Date }): Slot[] {
  const { policy, hours, blackouts, date, now } = input
  if (!isValidDateString(date) || isBlackedOut(date, blackouts)) return []
  const weekday = istParts(istInstant(date, 12 * 60)).weekday
  const earliest = now.getTime() + policy.minLeadMinutes * MS.minute
  const latest = now.getTime() + policy.maxHorizonDays * MS.day

  const slots: Slot[] = []
  for (const window of hours.filter((h) => h.weekday === weekday).sort((a, b) => a.opensMinute - b.opensMinute)) {
    for (let start = window.opensMinute; start + policy.slotMinutes <= window.closesMinute; start += policy.slotMinutes) {
      const startsAt = istInstant(date, start)
      const endsAt = istInstant(date, start + policy.slotMinutes)
      if (startsAt.getTime() < earliest || startsAt.getTime() > latest) continue
      slots.push({ startsAt, endsAt })
    }
  }
  return slots
}

export const overlaps = (a: Slot, b: Slot) => a.startsAt < b.endsAt && b.startsAt < a.endsAt

// ----------------------------------------------------------------------------- request validation

/**
 * Why a requested time range cannot be booked, or null when it can (before the database's own
 * overlap check, which is the final word). One message, for a person to read.
 */
export function problemWithRequest(input: {
  policy: LabPolicy
  hours: LabHoursWindow[]
  blackouts: LabBlackout[]
  now: Date
  startsAt: Date
  endsAt: Date
  headcount: number
}): string | null {
  const { policy, hours, blackouts, now, startsAt, endsAt, headcount } = input
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return 'Choose a start and an end time.'
  if (endsAt <= startsAt) return 'The end time must be after the start time.'
  if (!Number.isInteger(headcount) || headcount < 1) return 'Say how many people will use the space.'
  if (headcount > policy.capacity) return `This space holds ${policy.capacity} ${policy.capacity === 1 ? 'person' : 'people'} at a time.`

  const start = istParts(startsAt)
  const end = istParts(new Date(endsAt.getTime() - 1))
  if (start.date !== end.date) return 'A booking must start and end on the same day.'
  if (isBlackedOut(start.date, blackouts)) return 'The lab is closed on that day.'

  const length = (endsAt.getTime() - startsAt.getTime()) / MS.minute
  if (!Number.isInteger(length) || length % policy.slotMinutes !== 0) return `Bookings are made in blocks of ${policy.slotMinutes} minutes.`
  if (length / policy.slotMinutes > policy.maxConsecutiveSlots) return `You can book at most ${policy.maxConsecutiveSlots} consecutive blocks at once.`

  const endMinute = start.minuteOfDay + length
  const window = hours.find((h) => h.weekday === start.weekday && start.minuteOfDay >= h.opensMinute && endMinute <= h.closesMinute)
  if (!window) return 'That time is outside the lab’s opening hours.'
  if ((start.minuteOfDay - window.opensMinute) % policy.slotMinutes !== 0) return 'Pick a start time on the lab’s block boundaries.'

  if (startsAt.getTime() < now.getTime() + policy.minLeadMinutes * MS.minute) {
    return `Bookings must be made at least ${describeMinutes(policy.minLeadMinutes)} ahead.`
  }
  if (startsAt.getTime() > now.getTime() + policy.maxHorizonDays * MS.day) return `Bookings open up to ${policy.maxHorizonDays} days ahead.`
  return null
}

export function describeMinutes(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'}`
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`
  return `${minutes} minutes`
}

// ----------------------------------------------------------------------------- person limits

/** Hours already booked in the IST week of `startsAt`, plus this request, against the weekly cap. */
export function weeklyHoursProblem(input: { existing: Slot[]; request: Slot; maxHoursPerWeek: number }): string | null {
  const week = istWeekStart(input.request.startsAt)
  const hoursOf = (s: Slot) => (s.endsAt.getTime() - s.startsAt.getTime()) / (60 * MS.minute)
  const used = input.existing.filter((s) => istWeekStart(s.startsAt) === week).reduce((sum, s) => sum + hoursOf(s), 0)
  const total = used + hoursOf(input.request)
  return total > input.maxHoursPerWeek ? `That would be ${total} hours this week; the limit is ${input.maxHoursPerWeek}.` : null
}

// ----------------------------------------------------------------------------- state machine

export type BookingStatus = 'requested' | 'approved' | 'rejected' | 'cancelled' | 'alternative_proposed' | 'completed' | 'no_show'

/** Every permitted move of a booking. Anything not listed is refused, whoever asks. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  requested: ['approved', 'rejected', 'alternative_proposed', 'cancelled'],
  alternative_proposed: ['approved', 'cancelled', 'rejected'],
  approved: ['cancelled', 'completed', 'no_show'],
  rejected: [],
  cancelled: [],
  completed: [],
  no_show: [],
}

export const canTransition = (from: BookingStatus, to: BookingStatus) => BOOKING_TRANSITIONS[from].includes(to)

/** The statuses that hold a slot (the same list as the database exclusion constraint). */
export const LIVE_STATUSES: readonly BookingStatus[] = ['requested', 'approved', 'alternative_proposed']
