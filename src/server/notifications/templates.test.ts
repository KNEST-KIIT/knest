import { afterEach, describe, expect, it } from 'vitest'
import { applicationReceivedTemplate, applicationStatusChangedTemplate } from './templates'

it('does not promise a response date or interview details that the platform does not hold', () => {
  expect(applicationReceivedTemplate('Incubate').text).not.toContain('by the date')
  expect(applicationStatusChangedTemplate('Incubate', 'interview').text).toContain('contact you to arrange')
})

it('links application updates directly to the matching receipt', () => {
  expect(applicationReceivedTemplate('Incubate', 'application-123').text).toContain('/dashboard/applications/application-123')
  expect(applicationStatusChangedTemplate('Incubate', 'under_review', 'application-123').text).toContain('/dashboard/applications/application-123')
})

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
