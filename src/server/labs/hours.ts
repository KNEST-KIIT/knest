/**
 * Opening hours, slots, and the arithmetic that turns "Tuesday 09:00–18:00"
 * into "is this particular booking allowed".
 *
 * Pure on purpose: no database, no Payload, no session. Everything here is
 * unit-tested, because the failure mode of a mistake in it — a booking that
 * looks fine and quietly falls outside the hours a professor agreed to — is
 * one nobody notices until someone is standing outside a locked door.
 */

/**
 * KIIT is in Bhubaneswar, and a lab's open hours are wall-clock times on that
 * campus. They have to be read there rather than in whatever timezone the
 * server happens to run in — a hosting region change must not move anybody's
 * booking by five and a half hours.
 *
 * A fixed offset is exact here in a way it would not be almost anywhere else:
 * India Standard Time is UTC+05:30 year round and the country has observed no
 * daylight saving since 1945. If KNEST ever brokers a lab outside India this
 * has to become a per-space timezone and an `Intl` lookup.
 */
export const CAMPUS_UTC_OFFSET_MINUTES = 330

export type OpenHour = {
  /** '0' is Sunday, matching `Date.getUTCDay()`. Payload stores selects as strings. */
  weekday: string
  opensAt: string
  closesAt: string
}

export type CampusMoment = {
  /** 0 = Sunday. */
  weekday: number
  /** Minutes since campus midnight. */
  minuteOfDay: number
  year: number
  month: number
  day: number
}

/** Reads an instant as campus wall-clock time. */
export function campusMoment(date: Date): CampusMoment {
  const shifted = new Date(date.getTime() + CAMPUS_UTC_OFFSET_MINUTES * 60_000)
  return {
    weekday: shifted.getUTCDay(),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

/** The inverse: a campus wall-clock date and time as a real instant. */
export function campusInstant(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
): Date {
  const asUtc = Date.UTC(year, month - 1, day, 0, minuteOfDay)
  return new Date(asUtc - CAMPUS_UTC_OFFSET_MINUTES * 60_000)
}

/** 'HH:MM' → minutes since midnight, or null if it isn't one. */
export function parseTimeOfDay(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * As `parseTimeOfDay`, but also accepts '24:00' for a space that stays open to
 * the end of the day.
 *
 * The asymmetry is deliberate: midnight is a real closing time and not a real
 * opening one, and accepting '24:00' on both sides would let someone write a
 * window that opens after the day has ended.
 */
export function parseClosingTime(value: string | null | undefined): number | null {
  if (typeof value === 'string' && value.trim() === '24:00') return 24 * 60
  return parseTimeOfDay(value)
}

export function formatTimeOfDay(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60)
  const minutes = minuteOfDay % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export type OpenWindow = { opens: number; closes: number }

/**
 * The windows a space is open on one weekday.
 *
 * A row that does not parse, or that closes before it opens, is dropped rather
 * than clamped. A space is closed until someone says otherwise, and silently
 * reinterpreting '18:00–09:00' as a fifteen-hour day would invent permission
 * nobody granted.
 */
export function openWindowsFor(
  openHours: readonly OpenHour[] | null | undefined,
  weekday: number,
): OpenWindow[] {
  if (!openHours) return []
  return openHours
    .filter((entry) => Number(entry.weekday) === weekday)
    .map((entry) => ({
      opens: parseTimeOfDay(entry.opensAt),
      closes: parseClosingTime(entry.closesAt),
    }))
    .filter((window): window is OpenWindow => {
      return window.opens !== null && window.closes !== null && window.closes > window.opens
    })
    .sort((a, b) => a.opens - b.opens)
}

/**
 * Does this booking sit inside a single open window?
 *
 * Deliberately requires one window rather than a union of them: a space open
 * 09:00–12:00 and 14:00–17:00 is closed over lunch, and a booking spanning
 * 11:00–15:00 is not made legal by both halves being covered.
 *
 * A booking that crosses campus midnight is refused for the same reason — the
 * day it belongs to is ambiguous, and no window can contain it.
 */
export function isWithinOpenHours(
  openHours: readonly OpenHour[] | null | undefined,
  startsAt: Date,
  endsAt: Date,
): boolean {
  const start = campusMoment(startsAt)
  const end = campusMoment(endsAt)

  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day
  // Ending exactly at campus midnight is the one legitimate crossing: 23:00
  // to 00:00 is a normal last slot, and its end reads as minute 0 of the
  // following day.
  const endsAtMidnight = end.minuteOfDay === 0
  if (!sameDay && !endsAtMidnight) return false

  const endMinute = endsAtMidnight && !sameDay ? 24 * 60 : end.minuteOfDay
  if (endMinute <= start.minuteOfDay) return false

  return openWindowsFor(openHours, start.weekday).some(
    (window) => start.minuteOfDay >= window.opens && endMinute <= window.closes,
  )
}

/**
 * Every slot boundary a space offers on one campus day.
 *
 * Slots are laid out from each window's opening time, and a remainder too
 * short for a whole slot is dropped: a 09:00–12:30 window at 60 minutes gives
 * three slots, not three and a half.
 */
export function slotsForDay(
  openHours: readonly OpenHour[] | null | undefined,
  slotMinutes: number,
  year: number,
  month: number,
  day: number,
): { startsAt: Date; endsAt: Date; label: string }[] {
  const length = Math.max(15, Math.trunc(slotMinutes) || 60)
  const weekday = campusMoment(campusInstant(year, month, day, 12 * 60)).weekday

  const slots: { startsAt: Date; endsAt: Date; label: string }[] = []
  for (const window of openWindowsFor(openHours, weekday)) {
    for (let minute = window.opens; minute + length <= window.closes; minute += length) {
      slots.push({
        startsAt: campusInstant(year, month, day, minute),
        endsAt: campusInstant(year, month, day, minute + length),
        label: `${formatTimeOfDay(minute)}–${formatTimeOfDay(minute + length)}`,
      })
    }
  }
  return slots
}

/** How a booking's times read to a person, in campus time rather than the server's. */
export function formatCampusRange(startsAt: Date, endsAt: Date): string {
  const start = campusMoment(startsAt)
  const end = campusMoment(endsAt)
  return `${formatTimeOfDay(start.minuteOfDay)}–${formatTimeOfDay(end.minuteOfDay)}`
}

const CAMPUS_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * The date a booking falls on, on campus.
 *
 * `formatDate` in `src/lib/dates.ts` formats in whatever timezone the process
 * runs in, which for a booking is wrong twice over: a 21:00 IST slot is still
 * the same UTC day, but a 06:00 IST one is the *previous* UTC day, and on a
 * server running in UTC that renders yesterday's date next to today's time.
 * Shifting into campus time and then formatting as UTC gets both halves from
 * the same clock.
 */
export function formatCampusDate(date: Date): string {
  const shifted = new Date(date.getTime() + CAMPUS_UTC_OFFSET_MINUTES * 60_000)
  return CAMPUS_DATE.format(shifted)
}

/** '2026-09-14' in campus time — the shape the day picker passes around. */
export function campusDayKey(date: Date): string {
  const { year, month, day } = campusMoment(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The inverse of `campusDayKey`, refusing anything that isn't one. */
export function parseCampusDayKey(key: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Round-trip through a real date so 2026-02-30 is rejected rather than
  // silently rolling forward into March.
  const probe = campusInstant(year, month, day, 12 * 60)
  const moment = campusMoment(probe)
  if (moment.year !== year || moment.month !== month || moment.day !== day) return null
  return { year, month, day }
}
