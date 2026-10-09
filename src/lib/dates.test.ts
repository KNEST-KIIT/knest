import { describe, expect, it } from 'vitest'
import { formatDate, formatDateShort, formatEventTime, monthAndDay } from './dates'

// 20:30 UTC on 11 March is 02:00 on 12 March in India (UTC+5:30).
const lateUtc = '2026-03-11T20:30:00.000Z'

describe('dates are shown in India Standard Time whatever the server clock', () => {
  it('moves a late-evening UTC instant to the next Indian day', () => {
    expect(formatDate(lateUtc)).toBe('12 March 2026')
    expect(formatDateShort(lateUtc)).toBe('12 Mar 2026')
    expect(monthAndDay(lateUtc)).toEqual({ month: 'Mar', day: '12' })
  })

  it('states the zone on event times', () => {
    expect(formatEventTime(lateUtc)).toBe('12 March, 02:00 IST')
  })
})
