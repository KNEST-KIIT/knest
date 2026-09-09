import { describe, expect, it } from 'vitest'
import { holdsTheRoom, isLegalTransition, managerDecisions, nextStatuses } from './transitions'

const ALL = ['requested', 'approved', 'rejected', 'cancelled'] as const

describe('lab booking transitions', () => {
  it('lets a manager decide on a request', () => {
    expect(isLegalTransition('requested', 'approved')).toBe(true)
    expect(isLegalTransition('requested', 'rejected')).toBe(true)
  })

  it('lets an approved booking be given back', () => {
    expect(isLegalTransition('approved', 'cancelled')).toBe(true)
  })

  it('will not turn an approved booking into a rejected one', () => {
    // Reversing a decision and cancelling a booking read differently to the
    // founder holding it; collapsing them makes 'rejected' mean two things.
    expect(isLegalTransition('approved', 'rejected')).toBe(false)
  })

  it('will not reopen a decided booking', () => {
    for (const to of ALL) {
      expect(isLegalTransition('rejected', to)).toBe(false)
      expect(isLegalTransition('cancelled', to)).toBe(false)
    }
  })

  it('will not re-approve an approved booking', () => {
    expect(isLegalTransition('approved', 'approved')).toBe(false)
  })

  it('has no status that can transition to itself', () => {
    for (const status of ALL) {
      expect(isLegalTransition(status, status)).toBe(false)
    }
  })

  it('has no path back to requested from anywhere', () => {
    for (const status of ALL) {
      expect(nextStatuses(status)).not.toContain('requested')
    }
  })

  it('offers managers only the two real decisions', () => {
    expect(managerDecisions('requested')).toEqual(['approved', 'rejected'])
    expect(managerDecisions('approved')).toEqual([])
  })

  it('says only an approved booking holds the room', () => {
    expect(holdsTheRoom('approved')).toBe(true)
    for (const status of ['requested', 'rejected', 'cancelled'] as const) {
      expect(holdsTheRoom(status)).toBe(false)
    }
  })
})
