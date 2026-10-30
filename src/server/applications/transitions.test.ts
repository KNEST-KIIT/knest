import { describe, expect, it } from 'vitest'
import { isLegalStaffTransition, isLegalTransition, isStaffStatus, nextStatuses, STAFF_PERMITTED_STATUSES } from './transitions'

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
describe('isLegalStaffTransition', () => {
  it('prohibits staff from transitioning draft to submitted (only applicant can submit)', () => {
    expect(isLegalStaffTransition('draft', 'submitted')).toBe(false)
  })

  it('prohibits staff from moving any draft application', () => {
    for (const target of ALL_STATUSES) {
      expect(isLegalStaffTransition('draft', target)).toBe(false)
    }
  })

  it('prohibits staff from moving any application into draft', () => {
    for (const source of ALL_STATUSES) {
      expect(isLegalStaffTransition(source, 'draft')).toBe(false)
    }
  })

  it('prohibits staff from moving any application into submitted', () => {
    for (const source of ALL_STATUSES) {
      expect(isLegalStaffTransition(source, 'submitted')).toBe(false)
    }
  })

  it('allows valid review pipeline transitions by staff', () => {
    expect(isLegalStaffTransition('submitted', 'under_review')).toBe(true)
    expect(isLegalStaffTransition('submitted', 'rejected')).toBe(true)
    expect(isLegalStaffTransition('under_review', 'shortlisted')).toBe(true)
    expect(isLegalStaffTransition('under_review', 'rejected')).toBe(true)
    expect(isLegalStaffTransition('shortlisted', 'interview')).toBe(true)
    expect(isLegalStaffTransition('shortlisted', 'rejected')).toBe(true)
    expect(isLegalStaffTransition('interview', 'accepted')).toBe(true)
    expect(isLegalStaffTransition('interview', 'rejected')).toBe(true)
    expect(isLegalStaffTransition('interview', 'waitlisted')).toBe(true)
    expect(isLegalStaffTransition('waitlisted', 'accepted')).toBe(true)
    expect(isLegalStaffTransition('waitlisted', 'rejected')).toBe(true)
  })

  it('refuses illegal review skips and terminal state changes', () => {
    expect(isLegalStaffTransition('submitted', 'accepted')).toBe(false)
    expect(isLegalStaffTransition('submitted', 'waitlisted')).toBe(false)
    expect(isLegalStaffTransition('accepted', 'rejected')).toBe(false)
    expect(isLegalStaffTransition('rejected', 'accepted')).toBe(false)
  })
})

describe('isStaffStatus', () => {
  it('recognizes valid staff target statuses', () => {
    for (const status of STAFF_PERMITTED_STATUSES) {
      expect(isStaffStatus(status)).toBe(true)
    }
  })

  it('rejects draft and submitted as staff target statuses', () => {
    expect(isStaffStatus('draft')).toBe(false)
    expect(isStaffStatus('submitted')).toBe(false)
  })

  it('rejects unknown or invalid types', () => {
    expect(isStaffStatus('unknown')).toBe(false)
    expect(isStaffStatus(null)).toBe(false)
    expect(isStaffStatus(123)).toBe(false)
  })
})

