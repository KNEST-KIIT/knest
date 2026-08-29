import { describe, expect, it } from 'vitest'
import { isLegalTransition, nextStatuses } from './transitions'

const ALL_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'shortlisted',
  'interview',
  'accepted',
  'rejected',
  'waitlisted',
] as const

describe('isLegalTransition', () => {
  it('allows the applicant to submit a draft', () => {
    expect(isLegalTransition('draft', 'submitted')).toBe(true)
  })

  it('never allows skipping straight from submitted to a decision', () => {
    expect(isLegalTransition('submitted', 'accepted')).toBe(false)
    expect(isLegalTransition('submitted', 'waitlisted')).toBe(false)
  })

  it('never allows moving backwards toward draft from any state', () => {
    for (const status of ALL_STATUSES) {
      expect(isLegalTransition(status, 'draft')).toBe(false)
    }
  })

  it('treats accepted and rejected as terminal — nothing moves out of them', () => {
    for (const target of ALL_STATUSES) {
      expect(isLegalTransition('accepted', target)).toBe(false)
      expect(isLegalTransition('rejected', target)).toBe(false)
    }
  })

  it('lets a waitlisted applicant still be accepted or rejected later', () => {
    expect(isLegalTransition('waitlisted', 'accepted')).toBe(true)
    expect(isLegalTransition('waitlisted', 'rejected')).toBe(true)
    expect(isLegalTransition('waitlisted', 'shortlisted')).toBe(false)
  })

  it('every non-terminal status has at least one legal next status', () => {
    for (const status of ALL_STATUSES) {
      if (status === 'accepted' || status === 'rejected') continue
      expect(nextStatuses(status).length).toBeGreaterThan(0)
    }
  })

  it('rejects a status transitioning to itself', () => {
    for (const status of ALL_STATUSES) {
      expect(isLegalTransition(status, status)).toBe(false)
    }
  })
})
