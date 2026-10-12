import { describe, expect, it } from 'vitest'
import {
  generateSlots,
  isBlackedOut,
  isEscalated,
  isValidDateString,
  istInstant,
  istParts,
  istWeekStart,
  problemWithRequest,
  type LabHoursWindow,
  type LabPolicy,
} from './rules'

/**
 * Edge cases of the slot engine. India Standard Time is UTC+5:30 all year with no daylight saving,
 * so these tests pin the behaviour at the places a calendar usually goes wrong: the UTC date line,
 * month and year ends, the leap day, exact notice and horizon limits, and blackout end dates.
 */
const POLICY: LabPolicy = { slotMinutes: 60, maxConsecutiveSlots: 3, minLeadMinutes: 240, maxHorizonDays: 14, capacity: 4 }
const ALL_WEEK: LabHoursWindow[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensMinute: 0, closesMinute: 1440 }))
const at = (date: string, hh: number, mm = 0) => istInstant(date, hh * 60 + mm)
const LONG_AGO = new Date('2026-01-01T00:00:00Z')
/** Asks for a booking; unless `now` is given, "now" is two days before the start, inside notice and horizon. */
const ask = (over: Partial<Parameters<typeof problemWithRequest>[0]>) => {
  const startsAt = over.startsAt ?? at('2026-01-05', 10)
  return problemWithRequest({ policy: POLICY, hours: ALL_WEEK, blackouts: [], now: new Date(startsAt.getTime() - 2 * 86_400_000), startsAt, endsAt: at('2026-01-05', 11), headcount: 1, ...over })
}

describe('India time has no daylight saving and sits across the UTC date line', () => {
  it('00:00 IST on a Monday is Sunday 18:30 UTC, and still Monday in India', () => {
    const instant = new Date('2026-10-11T18:30:00Z')
    expect(istParts(instant)).toEqual({ date: '2026-10-12', weekday: 1, minuteOfDay: 0 })
    expect(istParts(new Date(instant.getTime() - 1))).toEqual({ date: '2026-10-11', weekday: 0, minuteOfDay: 1439 })
  })

  it('the offset is the same in January and in July', () => {
    expect(istInstant('2026-01-15', 9 * 60).toISOString()).toBe('2026-01-15T03:30:00.000Z')
    expect(istInstant('2026-07-15', 9 * 60).toISOString()).toBe('2026-07-15T03:30:00.000Z')
  })

  it('a day is always 24 hours long, whatever the month', () => {
    for (const day of ['2026-03-08', '2026-03-29', '2026-10-25', '2026-11-01']) {
      const start = istInstant(day).getTime()
      const next = new Date(start + 86_400_000)
      expect(istParts(next).minuteOfDay, day).toBe(0)
    }
  })

  it('a half-past-midnight slot belongs to its Indian date, not the UTC one', () => {
    const slots = generateSlots({ policy: { ...POLICY, slotMinutes: 30 }, hours: [{ weekday: 1, opensMinute: 0, closesMinute: 90 }], blackouts: [], date: '2026-10-12', now: new Date('2026-10-10T00:00:00Z') })
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(['2026-10-11T18:30:00.000Z', '2026-10-11T19:00:00.000Z', '2026-10-11T19:30:00.000Z'])
  })
})

describe('calendar boundaries', () => {
  it('knows the leap day', () => {
    expect(isValidDateString('2028-02-29')).toBe(true)
    expect(isValidDateString('2027-02-29')).toBe(false)
    expect(isValidDateString('2100-02-29')).toBe(false)
    expect(istParts(istInstant('2028-02-29', 600)).weekday).toBe(2) // a Tuesday
  })

  it('weeks run Monday to Sunday across a month end and a year end', () => {
    expect(istWeekStart(istInstant('2026-12-31', 600))).toBe('2026-12-28') // Thursday
    expect(istWeekStart(istInstant('2027-01-03', 1380))).toBe('2026-12-28') // Sunday 23:00
    expect(istWeekStart(istInstant('2027-01-04', 0))).toBe('2027-01-04') // Monday 00:00
    expect(istWeekStart(new Date('2027-01-03T18:30:00Z'))).toBe('2027-01-04') // Sunday night UTC is already Monday in India
  })

  it('the last block of the day may end exactly at midnight', () => {
    expect(ask({ startsAt: at('2026-01-05', 23), endsAt: at('2026-01-06', 0) })).toBeNull()
    expect(ask({ startsAt: at('2026-01-05', 23), endsAt: at('2026-01-06', 1) })).toMatch(/same day/)
  })
})

describe('notice and horizon are exact to the millisecond', () => {
  const start = at('2026-01-05', 10)
  it('accepts a request that starts exactly at now plus the minimum notice and refuses one a moment sooner', () => {
    const now = new Date(start.getTime() - 240 * 60_000)
    expect(ask({ now })).toBeNull()
    expect(ask({ now: new Date(now.getTime() + 1) })).toMatch(/at least 4 hours ahead/)
  })

  it('accepts a request exactly at the horizon and refuses one a moment beyond it', () => {
    const now = new Date(start.getTime() - 14 * 86_400_000)
    expect(ask({ now })).toBeNull()
    expect(ask({ now: new Date(now.getTime() - 1) })).toMatch(/up to 14 days/)
  })

  it('generateSlots includes the slot that starts exactly at the earliest allowed moment', () => {
    const now = new Date(at('2026-01-05', 12).getTime() - 240 * 60_000) // earliest = 12:00 IST
    const slots = generateSlots({ policy: POLICY, hours: [{ weekday: 1, opensMinute: 540, closesMinute: 780 }], blackouts: [], date: '2026-01-05', now })
    expect(slots.map((s) => istParts(s.startsAt).minuteOfDay / 60)).toEqual([12])
  })

  it('a lead time of zero and a one-day horizon still behave', () => {
    const tight: LabPolicy = { ...POLICY, minLeadMinutes: 0, maxHorizonDays: 1 }
    const now = at('2026-01-05', 9)
    expect(ask({ policy: tight, now, startsAt: now, endsAt: new Date(now.getTime() + 3_600_000) })).toBeNull()
    expect(ask({ policy: tight, now, startsAt: new Date(now.getTime() + 86_400_000 + 3_600_000), endsAt: new Date(now.getTime() + 86_400_000 + 7_200_000) })).toMatch(/up to 1 days/)
  })
})

describe('holidays and closed dates', () => {
  it('a closed period includes both its first and its last day, and nothing around it', () => {
    const closed = [{ startsOn: '2026-10-20', endsOn: '2026-10-22' }]
    expect(isBlackedOut('2026-10-19', closed)).toBe(false)
    expect(isBlackedOut('2026-10-20', closed)).toBe(true)
    expect(isBlackedOut('2026-10-22', closed)).toBe(true)
    expect(isBlackedOut('2026-10-23', closed)).toBe(false)
  })

  it('a closed period may span a month and a year end', () => {
    const closed = [{ startsOn: '2026-12-30', endsOn: '2027-01-02' }]
    expect(isBlackedOut('2026-12-31', closed)).toBe(true)
    expect(isBlackedOut('2027-01-01', closed)).toBe(true)
    expect(isBlackedOut('2027-01-03', closed)).toBe(false)
  })

  it('a booking in the last hour of a closed day is refused, one in the first hour after it is accepted', () => {
    const closed = [{ startsOn: '2026-01-05', endsOn: '2026-01-05' }]
    expect(ask({ blackouts: closed, startsAt: at('2026-01-05', 23), endsAt: at('2026-01-06', 0) })).toMatch(/closed/)
    expect(ask({ blackouts: closed, startsAt: at('2026-01-06', 0), endsAt: at('2026-01-06', 1) })).toBeNull()
  })

  it('several closed periods are each honoured, and an overlapping pair behaves like their union', () => {
    const closed = [{ startsOn: '2026-01-05', endsOn: '2026-01-07' }, { startsOn: '2026-01-06', endsOn: '2026-01-09' }]
    for (const day of ['2026-01-05', '2026-01-08', '2026-01-09']) expect(isBlackedOut(day, closed)).toBe(true)
    expect(isBlackedOut('2026-01-10', closed)).toBe(false)
  })

  it('no slots are offered on any day of a closed period', () => {
    const closed = [{ startsOn: '2026-01-05', endsOn: '2026-01-06' }]
    const slots = (date: string) => generateSlots({ policy: POLICY, hours: ALL_WEEK, blackouts: closed, date, now: LONG_AGO })
    expect(slots('2026-01-05')).toEqual([])
    expect(slots('2026-01-06')).toEqual([])
    expect(slots('2026-01-07').length).toBeGreaterThan(0)
  })
})

describe('boundary slots', () => {
  const hours: LabHoursWindow[] = [{ weekday: 1, opensMinute: 540, closesMinute: 1080 }]
  it('the first and the last block of a window are bookable; one minute outside is not', () => {
    const date = '2026-10-12'
    expect(ask({ hours, startsAt: at(date, 9), endsAt: at(date, 10) })).toBeNull()
    expect(ask({ hours, startsAt: at(date, 17), endsAt: at(date, 18) })).toBeNull()
    expect(ask({ hours, startsAt: at(date, 8, 59), endsAt: at(date, 9, 59) })).toMatch(/opening hours/)
    expect(ask({ hours, startsAt: at(date, 17, 1), endsAt: at(date, 18, 1) })).toMatch(/opening hours/)
  })

  it('blocks are cut from the window opening, so a half-hour opening shifts every boundary', () => {
    const half: LabHoursWindow[] = [{ weekday: 1, opensMinute: 570, closesMinute: 750 }] // 09:30 to 12:30
    const date = '2026-10-12'
    expect(ask({ hours: half, startsAt: at(date, 9, 30), endsAt: at(date, 10, 30) })).toBeNull()
    expect(ask({ hours: half, startsAt: at(date, 10), endsAt: at(date, 11) })).toMatch(/boundaries/)
  })

  it('a booking cannot straddle two separate windows even when they touch', () => {
    const touching: LabHoursWindow[] = [
      { weekday: 1, opensMinute: 540, closesMinute: 720 },
      { weekday: 1, opensMinute: 720, closesMinute: 1020 },
    ]
    const date = '2026-10-12'
    expect(ask({ hours: touching, startsAt: at(date, 11), endsAt: at(date, 12) })).toBeNull()
    expect(ask({ hours: touching, startsAt: at(date, 12), endsAt: at(date, 13) })).toBeNull()
    expect(ask({ hours: touching, startsAt: at(date, 11), endsAt: at(date, 13) })).toMatch(/opening hours/)
  })

  it('the longest allowed booking is accepted and one block more is refused', () => {
    expect(ask({ startsAt: at('2026-01-05', 10), endsAt: at('2026-01-05', 13) })).toBeNull()
    expect(ask({ startsAt: at('2026-01-05', 10), endsAt: at('2026-01-05', 14) })).toMatch(/at most 3 consecutive/)
  })
})

describe('escalation', () => {
  const requestedAt = new Date('2026-10-12T00:00:00Z')
  const base = { status: 'requested' as const, requestedAt, escalateAfterHours: 48, hasHead: true }
  it('escalates a request that has waited the full threshold, not one minute earlier', () => {
    expect(isEscalated({ ...base, now: new Date(requestedAt.getTime() + 48 * 3_600_000 - 60_000) })).toEqual({ escalated: false, reason: null })
    expect(isEscalated({ ...base, now: new Date(requestedAt.getTime() + 48 * 3_600_000) })).toEqual({ escalated: true, reason: 'waiting' })
  })

  it('a lab with no head escalates at once', () => {
    expect(isEscalated({ ...base, hasHead: false, now: requestedAt })).toEqual({ escalated: true, reason: 'no_head' })
  })

  it('only a request waiting for a decision can be escalated', () => {
    for (const status of ['approved', 'rejected', 'cancelled', 'alternative_proposed', 'completed', 'no_show'] as const) {
      expect(isEscalated({ ...base, status, hasHead: false, now: new Date(requestedAt.getTime() + 1e9) }).escalated, status).toBe(false)
    }
  })

  it('uses the lab’s own threshold', () => {
    const now = new Date(requestedAt.getTime() + 5 * 3_600_000)
    expect(isEscalated({ ...base, escalateAfterHours: 4, now }).escalated).toBe(true)
    expect(isEscalated({ ...base, escalateAfterHours: 6, now }).escalated).toBe(false)
  })
})
