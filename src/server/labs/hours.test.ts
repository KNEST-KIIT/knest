import { describe, expect, it } from 'vitest'
import {
  campusDayKey,
  campusInstant,
  campusMoment,
  formatCampusDate,
  formatTimeOfDay,
  isWithinOpenHours,
  openWindowsFor,
  parseCampusDayKey,
  parseClosingTime,
  parseTimeOfDay,
  slotsForDay,
} from './hours'

/** Monday 14 September 2026, 09:00 campus time = 03:30 UTC. */
const MONDAY_0900 = new Date('2026-09-14T03:30:00.000Z')
const MONDAY_1000 = new Date('2026-09-14T04:30:00.000Z')
const MONDAY_1300 = new Date('2026-09-14T07:30:00.000Z')

const WEEKDAY_HOURS = [
  { weekday: '1', opensAt: '09:00', closesAt: '18:00' },
  { weekday: '2', opensAt: '09:00', closesAt: '18:00' },
]

describe('campus time', () => {
  it('reads an instant as Bhubaneswar wall-clock time', () => {
    const moment = campusMoment(MONDAY_0900)
    expect(moment).toEqual({ weekday: 1, minuteOfDay: 9 * 60, year: 2026, month: 9, day: 14 })
  })

  it('round-trips a wall-clock time back to the same instant', () => {
    expect(campusInstant(2026, 9, 14, 9 * 60).toISOString()).toBe(MONDAY_0900.toISOString())
  })

  it('puts late-evening campus time on the campus day, not the UTC one', () => {
    // 23:00 IST on the 14th is 17:30 UTC on the 14th; the naive mistake is a
    // date that has already rolled over.
    const late = campusMoment(new Date('2026-09-14T17:30:00.000Z'))
    expect(late.day).toBe(14)
    expect(late.minuteOfDay).toBe(23 * 60)
  })

  it('puts early-morning campus time on the following campus day', () => {
    // 00:30 IST on the 15th is 19:00 UTC on the 14th.
    const early = campusMoment(new Date('2026-09-14T19:00:00.000Z'))
    expect(early.day).toBe(15)
    expect(early.minuteOfDay).toBe(30)
  })

  it('formats a day key in campus time', () => {
    expect(campusDayKey(new Date('2026-09-14T19:00:00.000Z'))).toBe('2026-09-15')
  })

  it('rejects a day key that is not a real date', () => {
    expect(parseCampusDayKey('2026-02-30')).toBeNull()
    expect(parseCampusDayKey('2026-13-01')).toBeNull()
    expect(parseCampusDayKey('14/09/2026')).toBeNull()
    expect(parseCampusDayKey('2026-09-14')).toEqual({ year: 2026, month: 9, day: 14 })
  })
})

describe('parseTimeOfDay', () => {
  it('reads a time of day', () => {
    expect(parseTimeOfDay('09:00')).toBe(540)
    expect(parseTimeOfDay('9:05')).toBe(545)
    expect(parseTimeOfDay('  18:30 ')).toBe(1110)
    expect(parseTimeOfDay('00:00')).toBe(0)
  })

  it('refuses anything that is not one', () => {
    for (const bad of ['24:00', '09:60', '9', '09:0', 'nine', '', null, undefined, '09:00:00']) {
      expect(parseTimeOfDay(bad)).toBeNull()
    }
  })

  it('round-trips through formatTimeOfDay', () => {
    for (const value of ['00:00', '09:00', '13:45', '23:59']) {
      expect(formatTimeOfDay(parseTimeOfDay(value)!)).toBe(value)
    }
  })
})

describe('parseClosingTime', () => {
  it('accepts midnight as a closing time, which parseTimeOfDay does not', () => {
    expect(parseTimeOfDay('24:00')).toBeNull()
    expect(parseClosingTime('24:00')).toBe(1440)
  })

  it('is otherwise the same parser', () => {
    expect(parseClosingTime('18:00')).toBe(1080)
    expect(parseClosingTime('25:00')).toBeNull()
  })
})

describe('openWindowsFor', () => {
  it('returns only the windows for that weekday', () => {
    expect(openWindowsFor(WEEKDAY_HOURS, 1)).toEqual([{ opens: 540, closes: 1080 }])
    expect(openWindowsFor(WEEKDAY_HOURS, 3)).toEqual([])
  })

  it('drops a window that closes before it opens rather than reinterpreting it', () => {
    expect(openWindowsFor([{ weekday: '1', opensAt: '18:00', closesAt: '09:00' }], 1)).toEqual([])
  })

  it('drops a window with an unparseable time rather than guessing', () => {
    expect(openWindowsFor([{ weekday: '1', opensAt: 'morning', closesAt: '18:00' }], 1)).toEqual([])
  })

  it('sorts multiple windows by opening time', () => {
    const split = [
      { weekday: '1', opensAt: '14:00', closesAt: '17:00' },
      { weekday: '1', opensAt: '09:00', closesAt: '12:00' },
    ]
    expect(openWindowsFor(split, 1)).toEqual([
      { opens: 540, closes: 720 },
      { opens: 840, closes: 1020 },
    ])
  })

  it('treats no hours at all as closed', () => {
    expect(openWindowsFor(null, 1)).toEqual([])
    expect(openWindowsFor([], 1)).toEqual([])
  })
})

describe('isWithinOpenHours', () => {
  it('allows a booking inside the window', () => {
    expect(isWithinOpenHours(WEEKDAY_HOURS, MONDAY_0900, MONDAY_1000)).toBe(true)
  })

  it('refuses a booking on a day with no hours', () => {
    const sunday = [{ weekday: '0', opensAt: '09:00', closesAt: '18:00' }]
    expect(isWithinOpenHours(sunday, MONDAY_0900, MONDAY_1000)).toBe(false)
  })

  it('refuses a booking that starts before opening', () => {
    const from0800 = new Date('2026-09-14T02:30:00.000Z')
    expect(isWithinOpenHours(WEEKDAY_HOURS, from0800, MONDAY_1000)).toBe(false)
  })

  it('refuses a booking that runs past closing', () => {
    const to1900 = new Date('2026-09-14T13:30:00.000Z')
    expect(isWithinOpenHours(WEEKDAY_HOURS, MONDAY_1300, to1900)).toBe(false)
  })

  it('allows a booking that ends exactly at closing', () => {
    const at1700 = new Date('2026-09-14T11:30:00.000Z')
    const at1800 = new Date('2026-09-14T12:30:00.000Z')
    expect(isWithinOpenHours(WEEKDAY_HOURS, at1700, at1800)).toBe(true)
  })

  it('will not span a lunch break, even though both halves are open', () => {
    const split = [
      { weekday: '1', opensAt: '09:00', closesAt: '12:00' },
      { weekday: '1', opensAt: '14:00', closesAt: '17:00' },
    ]
    const at1100 = new Date('2026-09-14T05:30:00.000Z')
    const at1500 = new Date('2026-09-14T09:30:00.000Z')
    expect(isWithinOpenHours(split, at1100, at1500)).toBe(false)
    // …but each half on its own is fine.
    expect(isWithinOpenHours(split, at1100, new Date('2026-09-14T06:30:00.000Z'))).toBe(true)
  })

  it('refuses a zero-length or reversed booking', () => {
    expect(isWithinOpenHours(WEEKDAY_HOURS, MONDAY_1000, MONDAY_1000)).toBe(false)
    expect(isWithinOpenHours(WEEKDAY_HOURS, MONDAY_1300, MONDAY_1000)).toBe(false)
  })

  it('allows a last slot that ends at campus midnight', () => {
    const lateHours = [{ weekday: '1', opensAt: '22:00', closesAt: '24:00' }]
    const at2300 = new Date('2026-09-14T17:30:00.000Z')
    const atMidnight = new Date('2026-09-14T18:30:00.000Z')
    expect(isWithinOpenHours(lateHours, at2300, atMidnight)).toBe(true)
  })

  it('refuses a booking that crosses campus midnight into the next day', () => {
    const lateHours = [
      { weekday: '1', opensAt: '22:00', closesAt: '24:00' },
      { weekday: '2', opensAt: '00:00', closesAt: '06:00' },
    ]
    const at2300 = new Date('2026-09-14T17:30:00.000Z')
    const at0100 = new Date('2026-09-14T19:30:00.000Z')
    expect(isWithinOpenHours(lateHours, at2300, at0100)).toBe(false)
  })
})

describe('slotsForDay', () => {
  it('lays slots out from the opening time', () => {
    const slots = slotsForDay(WEEKDAY_HOURS, 60, 2026, 9, 14)
    expect(slots).toHaveLength(9)
    expect(slots[0]!.label).toBe('09:00–10:00')
    expect(slots.at(-1)!.label).toBe('17:00–18:00')
    expect(slots[0]!.startsAt.toISOString()).toBe(MONDAY_0900.toISOString())
  })

  it('drops a remainder too short for a whole slot', () => {
    const hours = [{ weekday: '1', opensAt: '09:00', closesAt: '12:30' }]
    const slots = slotsForDay(hours, 60, 2026, 9, 14)
    expect(slots.map((slot) => slot.label)).toEqual(['09:00–10:00', '10:00–11:00', '11:00–12:00'])
  })

  it('returns nothing for a closed day', () => {
    expect(slotsForDay(WEEKDAY_HOURS, 60, 2026, 9, 13)).toEqual([])
  })

  it('covers every window on the day', () => {
    const split = [
      { weekday: '1', opensAt: '09:00', closesAt: '11:00' },
      { weekday: '1', opensAt: '14:00', closesAt: '16:00' },
    ]
    expect(slotsForDay(split, 60, 2026, 9, 14).map((slot) => slot.label)).toEqual([
      '09:00–10:00',
      '10:00–11:00',
      '14:00–15:00',
      '15:00–16:00',
    ])
  })

  it('every slot it offers is a slot the hours accept', () => {
    for (const slot of slotsForDay(WEEKDAY_HOURS, 90, 2026, 9, 14)) {
      expect(isWithinOpenHours(WEEKDAY_HOURS, slot.startsAt, slot.endsAt)).toBe(true)
    }
  })
})

describe('formatCampusDate', () => {
  it('uses the campus day, not the server day', () => {
    // 06:00 IST on the 15th is 00:30 UTC on the 15th — same day either way.
    expect(formatCampusDate(new Date('2026-09-15T00:30:00.000Z'))).toBe('15 September 2026')
    // 00:30 IST on the 15th is 19:00 UTC on the 14th. Formatting in UTC would
    // print the 14th next to a time of 00:30.
    expect(formatCampusDate(new Date('2026-09-14T19:00:00.000Z'))).toBe('15 September 2026')
  })
})
