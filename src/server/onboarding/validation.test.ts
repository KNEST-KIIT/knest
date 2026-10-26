import { describe, expect, it } from 'vitest'
import { stepMentorProfileSchema, stepProfileSchema } from './validation'

describe('Onboarding step validation', () => {
  it('identifies missing name with field-level error', () => {
    const res = stepProfileSchema.safeParse({ name: '   ', linkedinUrl: '' })
    expect(res.success).toBe(false)
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'name')
      expect(issue).toBeDefined()
      expect(issue?.message).toBe('Tell us your name.')
    }
  })

  it('identifies invalid LinkedIn URL with field-level error', () => {
    const res = stepProfileSchema.safeParse({ name: 'Valid Name', linkedinUrl: 'not-a-url' })
    expect(res.success).toBe(false)
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'linkedinUrl')
      expect(issue).toBeDefined()
      expect(issue?.message).toBe('That doesn’t look like a URL.')
    }
  })

  it('accepts valid profile with empty or valid LinkedIn URL', () => {
    const resEmpty = stepProfileSchema.safeParse({ name: 'Valid Name', linkedinUrl: '' })
    expect(resEmpty.success).toBe(true)

    const resUrl = stepProfileSchema.safeParse({ name: 'Valid Name', linkedinUrl: 'https://linkedin.com/in/test' })
    expect(resUrl.success).toBe(true)
  })

  it('validates mentor profile requiring name and expertiseAreas', () => {
    const resMissing = stepMentorProfileSchema.safeParse({
      name: '',
      expertiseAreas: [],
      mentorAvailability: 'open',
    })
    expect(resMissing.success).toBe(false)
    if (!resMissing.success) {
      const fields = resMissing.error.issues.map((i) => i.path[0])
      expect(fields).toContain('name')
      expect(fields).toContain('expertiseAreas')
    }
  })
})
