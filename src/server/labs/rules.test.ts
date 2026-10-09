import { describe, expect, it } from 'vitest'
import {
  BOOKING_TRANSITIONS,
  canTransition,
  generateSlots,
  istInstant,
  istParts,
  istWeekStart,
  isValidDateString,
  LIVE_STATUSES,
  overlaps,
  problemWithRequest,
  weeklyHoursProblem,
  type BookingStatus,
  type LabHoursWindow,
  type LabPolicy,
} from './rules'

// Monday 12 October 2026 (IST). A lab open 09:00 to 18:00 on Mondays and 10:00 to 14:00 on Saturdays.
const MONDAY = '2026-10-12'
const POLICY: LabPolicy = { slotMinutes: 60, maxConsecutiveSlots: 3, minLeadMinutes: 240, maxHorizonDays: 14, capacity: 4 }
const HOURS: LabHoursWindow[] = [
  { weekday: 1, opensMinute: 9 * 60, closesMinute: 18 * 60 },
  { weekday: 6, opensMinute: 10 * 60, closesMinute: 14 * 60 },
]
const LONG_AGO = new Date('2026-10-01T00:00:00Z')
const at = (date: string, hh: number, mm = 0) => istInstant(date, hh * 60 + mm)
const request = (over: Partial<Parameters<typeof problemWithRequest>[0]> & { start?: Date; end?: Date } = {}) =>
  problemWithRequest({ policy: POLICY, hours: HOURS, blackouts: [], now: LONG_AGO, startsAt: over.start ?? at(MONDAY, 10), endsAt: over.end ?? at(MONDAY, 11), headcount: 2, ...over })

describe('India time', () => {
  it('reads an instant as an IST date, weekday and minute (02:00 IST is still the previous day in UTC)', () => {
    expect(istParts(new Date('2026-10-11T20:30:00Z'))).toEqual({ date: '2026-10-12', weekday: 1, minuteOfDay: 120 })
    expect(istParts(new Date('2026-10-12T18:29:00Z')).date).toBe('2026-10-12')
    expect(istParts(new Date('2026-10-12T18:30:00Z')).date).toBe('2026-10-13')
  })

  it('istInstant is the inverse', () => {
    expect(istInstant(MONDAY, 9 * 60).toISOString()).toBe('2026-10-12T03:30:00.000Z')
    expect(istParts(istInstant('2026-12-31', 23 * 60 + 59))).toEqual({ date: '2026-12-31', weekday: 4, minuteOfDay: 23 * 60 + 59 })
  })

  it('weeks run Monday to Sunday', () => {
    expect(istWeekStart(at('2026-10-12', 9))).toBe('2026-10-12')
    expect(istWeekStart(at('2026-10-18', 20))).toBe('2026-10-12') // Sunday
    expect(istWeekStart(at('2026-10-19', 1))).toBe('2026-10-19')
  })

  it('validates date strings strictly', () => {
    expect(isValidDateString('2026-02-28')).toBe(true)
    for (const bad of ['2026-02-30', '2026-13-01', '26-10-12', '2026-10-1', '', 'tomorrow']) expect(isValidDateString(bad), bad).toBe(false)
  })
})

describe('generateSlots', () => {
  it('cuts the opening hours into back-to-back slots', () => {
    const slots = generateSlots({ policy: POLICY, hours: HOURS, blackouts: [], date: MONDAY, now: LONG_AGO })
    expect(slots).toHaveLength(9)
    expect(slots[0]!.startsAt).toEqual(at(MONDAY, 9))
    expect(slots[8]!.endsAt).toEqual(at(MONDAY, 18))
    for (let i = 1; i < slots.length; i++) expect(slots[i]!.startsAt).toEqual(slots[i - 1]!.endsAt)
  })

  it('offers nothing on a closed weekday, a blackout date, an invalid date or beyond the horizon', () => {
    expect(generateSlots({ policy: POLICY, hours: HOURS, blackouts: [], date: '2026-10-13', now: LONG_AGO })).toEqual([]) // Tuesday
    expect(generateSlots({ policy: POLICY, hours: HOURS, blackouts: [{ startsOn: '2026-10-10', endsOn: '2026-10-14' }], date: MONDAY, now: LONG_AGO })).toEqual([])
    expect(generateSlots({ policy: POLICY, hours: HOURS, blackouts: [], date: '2026-02-30', now: LONG_AGO })).toEqual([])
    expect(generateSlots({ policy: POLICY, hours: HOURS, blackouts: [], date: MONDAY, now: new Date('2026-09-01T00:00:00Z') })).toEqual([])
  })

  it('drops slots that start before now plus the lead time', () => {
    const now = new Date('2026-10-12T04:00:00Z') // 09:30 IST; with a 4 h lead the first slot is 14:00
    const slots = generateSlots({ policy: POLICY, hours: HOURS, blackouts: [], date: MONDAY, now })
    expect(slots.map((s) => istParts(s.startsAt).minuteOfDay / 60)).toEqual([14, 15, 16, 17])
  })

  it('does not offer a slot that does not fit inside the window', () => {
    const slots = generateSlots({ policy: POLICY, hours: [{ weekday: 1, opensMinute: 540, closesMinute: 630 }], blackouts: [], date: MONDAY, now: LONG_AGO })
    expect(slots).toHaveLength(1) // 09:00 to 10:00 fits; 10:00 to 11:00 would run past 10:30
  })

  it('supports several windows in a day', () => {
    const two: LabHoursWindow[] = [{ weekday: 1, opensMinute: 540, closesMinute: 600 }, { weekday: 1, opensMinute: 840, closesMinute: 960 }]
    expect(generateSlots({ policy: POLICY, hours: two, blackouts: [], date: MONDAY, now: LONG_AGO })).toHaveLength(3)
  })
})

describe('problemWithRequest', () => {
  it('accepts a valid request, including the longest allowed', () => {
    expect(request()).toBeNull()
    expect(request({ end: at(MONDAY, 13) })).toBeNull() // 10:00 to 13:00 = 3 blocks
    expect(request({ start: at(MONDAY, 17), end: at(MONDAY, 18) })).toBeNull() // ends exactly at closing
  })

  it.each([
    ['end before start', { start: at(MONDAY, 11), end: at(MONDAY, 10) }, /after the start/],
    ['not a whole number of blocks', { end: at(MONDAY, 10, 45) }, /blocks of 60 minutes/],
    ['too many consecutive blocks', { end: at(MONDAY, 14) }, /at most 3/],
    ['before opening', { start: at(MONDAY, 8), end: at(MONDAY, 9) }, /opening hours/],
    ['after closing', { start: at(MONDAY, 17, 30), end: at(MONDAY, 18, 30) }, /opening hours|boundaries/],
    ['off the block boundaries', { start: at(MONDAY, 10, 30), end: at(MONDAY, 11, 30) }, /boundaries/],
    ['a closed weekday', { start: at('2026-10-13', 10), end: at('2026-10-13', 11) }, /opening hours/],
    ['across midnight', { start: at(MONDAY, 23), end: at('2026-10-13', 1) }, /same day/],
    ['too many people', { headcount: 5 }, /holds 4 people/],
    ['nobody', { headcount: 0 }, /how many people/],
    ['a non-integer headcount', { headcount: 1.5 }, /how many people/],
    ['an invalid date', { start: new Date('nope') }, /start and an end/],
  ])('refuses %s', (_label, over, message) => {
    expect(request(over as never)).toMatch(message)
  })

  it('refuses a blackout date, too little notice and too far ahead', () => {
    expect(request({ blackouts: [{ startsOn: MONDAY, endsOn: MONDAY }] })).toMatch(/closed/)
    const now = new Date('2026-10-12T03:30:00Z') // 09:00 IST: a 10:00 start is only an hour away
    expect(request({ now })).toMatch(/at least 4 hours ahead/)
    expect(request({ now: new Date('2026-09-20T00:00:00Z') })).toMatch(/up to 14 days/)
  })

  it('says a Saturday short window is a window: 10:00 to 14:00 fits, 13:00 to 15:00 does not', () => {
    const sat = '2026-10-17'
    const now = new Date('2026-10-10T00:00:00Z') // inside the 14-day horizon
    expect(request({ now, start: at(sat, 13), end: at(sat, 14) })).toBeNull()
    expect(request({ now, start: at(sat, 13), end: at(sat, 15) })).toMatch(/opening hours/)
  })
})

describe('weeklyHoursProblem', () => {
  const slot = (date: string, from: number, to: number) => ({ startsAt: at(date, from), endsAt: at(date, to) })
  it('counts only the same IST week and refuses the request that would pass the cap', () => {
    const existing = [slot('2026-10-12', 9, 12), slot('2026-10-13', 9, 11), slot('2026-10-19', 9, 18)] // 5 h this week, 9 h next
    expect(weeklyHoursProblem({ existing, request: slot('2026-10-14', 9, 10), maxHoursPerWeek: 6 })).toBeNull() // total 6
    expect(weeklyHoursProblem({ existing, request: slot('2026-10-14', 9, 11), maxHoursPerWeek: 6 })).toMatch(/7 hours this week; the limit is 6/)
  })
})

describe('overlaps', () => {
  const s = (a: number, b: number) => ({ startsAt: at(MONDAY, a), endsAt: at(MONDAY, b) })
  it('treats touching ranges as not overlapping', () => {
    expect(overlaps(s(9, 10), s(10, 11))).toBe(false)
    expect(overlaps(s(9, 11), s(10, 12))).toBe(true)
    expect(overlaps(s(9, 12), s(10, 11))).toBe(true)
  })
})

describe('the booking state machine', () => {
  const ALL = Object.keys(BOOKING_TRANSITIONS) as BookingStatus[]
  it('lets a request be approved, rejected, countered or cancelled, and nothing else', () => {
    expect(BOOKING_TRANSITIONS.requested).toEqual(['approved', 'rejected', 'alternative_proposed', 'cancelled'])
  })
  it('terminal states have no way out', () => {
    for (const s of ['rejected', 'cancelled', 'completed', 'no_show'] as const) for (const to of ALL) expect(canTransition(s, to), `${s} -> ${to}`).toBe(false)
  })
  it('an approved booking can only be cancelled or closed out by attendance', () => {
    expect(BOOKING_TRANSITIONS.approved).toEqual(['cancelled', 'completed', 'no_show'])
    expect(canTransition('approved', 'requested')).toBe(false)
  })
  it('never moves a booking to itself', () => {
    for (const s of ALL) expect(canTransition(s, s)).toBe(false)
  })
  it('the live statuses are exactly those that can still be decided or honoured', () => {
    expect([...LIVE_STATUSES].sort()).toEqual(['alternative_proposed', 'approved', 'requested'])
  })
})
