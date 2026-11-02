import { describe, expect, it } from 'vitest'
import { closedReason, deadlineInstant } from './availability'

const NOW = new Date('2026-10-12T10:00:00Z')

describe('closedReason', () => {
  it('is null while open with no deadline', () => {
    expect(closedReason({ applicationStatus: 'open', applicationDeadline: null }, NOW)).toBeNull()
  })
  it('is null before the deadline', () => {
    expect(closedReason({ applicationStatus: 'open', applicationDeadline: '2026-10-13T00:00:00Z' }, NOW)).toBeNull()
  })
  it('names the closing date after the deadline', () => {
    expect(closedReason({ applicationStatus: 'open', applicationDeadline: '2026-10-11T00:00:00Z' }, NOW)).toBe(
      'Applications for this program closed on 11 October 2026.',
    )
  })
  it('keeps a date-only deadline open until the end of that day in India', () => {
    const deadline = '2026-10-12T00:00:00Z'
    // 17:59 IST on 12 October is still inside the day; 00:01 IST on 13 October is not.
    expect(closedReason({ applicationStatus: 'open', applicationDeadline: deadline }, new Date('2026-10-12T12:29:00Z'))).toBeNull()
    expect(closedReason({ applicationStatus: 'open', applicationDeadline: deadline }, new Date('2026-10-12T18:31:00Z'))).toMatch(/closed on/)
  })
  it('treats the bare date and the 12:00 UTC day-picker value the same way', () => {
    const end = deadlineInstant('2026-10-12').getTime()
    expect(deadlineInstant('2026-10-12T12:00:00.000Z').getTime()).toBe(end)
    expect(deadlineInstant('2026-10-12T00:00:00.000Z').getTime()).toBe(end)
    expect(new Date(end).toISOString()).toBe('2026-10-12T18:29:59.999Z')
  })
  it('honours a deadline with a real time of day exactly', () => {
    expect(deadlineInstant('2026-10-12T11:30:00.000Z').toISOString()).toBe('2026-10-12T11:30:00.000Z')
  })
  it.each(['closed', 'opening_soon', 'in_progress'])('refuses when the status is %s', (applicationStatus) => {
    expect(closedReason({ applicationStatus, applicationDeadline: null }, NOW)).toMatch(/aren’t open/)
  })
})
