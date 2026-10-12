import { describe, expect, it } from 'vitest'
import { closedReason } from './availability'

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
  it.each(['closed', 'opening_soon', 'in_progress'])('refuses when the status is %s', (applicationStatus) => {
    expect(closedReason({ applicationStatus, applicationDeadline: null }, NOW)).toMatch(/aren’t open/)
  })
})
