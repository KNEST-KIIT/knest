import { describe, expect, it } from 'vitest'
import { levelRequestStatus } from '@/db/schema'
import { isLegalTransition, nextStatuses, staffDecisions } from './transitions'

type Status = (typeof levelRequestStatus.enumValues)[number]
const ALL_STATUSES = levelRequestStatus.enumValues as readonly Status[]

describe('level request transitions', () => {
  it('lets staff approve or reject a pending request', () => {
    expect(isLegalTransition('pending', 'approved')).toBe(true)
    expect(isLegalTransition('pending', 'rejected')).toBe(true)
  })

  it('lets the founder withdraw a pending request', () => {
    expect(isLegalTransition('pending', 'withdrawn')).toBe(true)
  })

  it('never offers withdrawal to a staff reviewer', () => {
    // Withdrawing is the founder's move. Staff rejecting a request and staff
    // marking it withdrawn are different events and must not be confusable.
    expect(staffDecisions('pending')).not.toContain('withdrawn')
    expect(staffDecisions('pending')).toEqual(['approved', 'rejected'])
  })

  it('treats every decided state as terminal', () => {
    for (const status of ['approved', 'rejected', 'withdrawn'] as const) {
      expect(nextStatuses(status)).toEqual([])
    }
  })

  it('cannot reopen a decided request', () => {
    for (const from of ['approved', 'rejected', 'withdrawn'] as const) {
      for (const to of ALL_STATUSES) {
        expect(isLegalTransition(from, to)).toBe(false)
      }
    }
  })

  it('has no self-transitions', () => {
    for (const status of ALL_STATUSES) {
      expect(isLegalTransition(status, status)).toBe(false)
    }
  })

  it('cannot move backwards to pending', () => {
    for (const from of ALL_STATUSES) {
      if (from === 'pending') continue
      expect(isLegalTransition(from, 'pending')).toBe(false)
    }
  })

  it('covers every status in the enum', () => {
    // A new enum value with no row in the table would throw on lookup.
    for (const status of ALL_STATUSES) {
      expect(() => nextStatuses(status)).not.toThrow()
    }
  })
})
