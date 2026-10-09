import { afterEach, describe, expect, it } from 'vitest'
import { applicationReceivedTemplate, applicationStatusChangedTemplate } from './templates'

const original = process.env.NEXT_PUBLIC_SITE_URL
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = original
})

describe('notification e-mails link to the site, not to a bare path', () => {
  it('uses the configured origin and tolerates a trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://knest.example/'
    expect(applicationReceivedTemplate('Incubate').text).toContain('https://knest.example/dashboard/applications')
    expect(applicationStatusChangedTemplate('Incubate', 'accepted').text).toContain('https://knest.example/dashboard/applications')
  })

  it('keeps the subject identical for every outcome', () => {
    const subjects = new Set(['accepted', 'rejected', 'waitlisted', 'shortlisted'].map((s) => applicationStatusChangedTemplate('Incubate', s as never).subject))
    expect(subjects.size).toBe(1)
  })
})
