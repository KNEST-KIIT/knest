import { describe, expect, it } from 'vitest'
import { applicationStatus } from '@/db/schema'
import {
  applicationReceivedTemplate,
  applicationStatusChangedTemplate,
} from '@/server/notifications/templates'
import { emailUrl, resetPasswordTemplate, verifyEmailTemplate } from './templates'

const ALL_STATUSES = applicationStatus.enumValues

describe('status subjects', () => {
  /**
   * CONTENT_SPEC.md §7's one hard rule about email, and the one most likely to
   * be "improved" later by someone who thinks a clearer subject line is kinder.
   * It is not: a subject that names the outcome delivers a rejection in a
   * lock-screen preview, in public, before the applicant chose to read it.
   */
  it('are identical for every outcome', () => {
    const subjects = new Set(
      ALL_STATUSES.map((status) => applicationStatusChangedTemplate('Founder Launchpad', status).subject),
    )
    expect(subjects.size).toBe(1)
  })

  it('never name the outcome', () => {
    for (const status of ALL_STATUSES) {
      const { subject } = applicationStatusChangedTemplate('Founder Launchpad', status)
      expect(subject.toLowerCase()).not.toContain('accept')
      expect(subject.toLowerCase()).not.toContain('reject')
      expect(subject.toLowerCase()).not.toContain('shortlist')
      expect(subject.toLowerCase()).not.toContain('waitlist')
    }
  })
})

describe('email bodies', () => {
  it('link absolutely, never to a bare path', () => {
    const emails = [
      verifyEmailTemplate(emailUrl('/verify/confirm')).text,
      resetPasswordTemplate(emailUrl('/reset/confirm')).text,
      applicationReceivedTemplate('Founder Launchpad').text,
      ...ALL_STATUSES.map((s) => applicationStatusChangedTemplate('Founder Launchpad', s).text),
    ]
    for (const text of emails) {
      // A path that isn't preceded by a scheme+host is unclickable in a mail
      // client — this is what the application emails used to ship.
      const bareLink = /(^|[\s\n])\/[a-z]/.test(text)
      expect(bareLink).toBe(false)
      expect(text).toContain('http')
    }
  })

  it('all carry the account footer §7 specifies', () => {
    const emails = [
      verifyEmailTemplate('https://example.test/x').text,
      resetPasswordTemplate('https://example.test/x').text,
      applicationReceivedTemplate('Founder Launchpad').text,
      applicationStatusChangedTemplate('Founder Launchpad', 'accepted').text,
    ]
    for (const text of emails) {
      expect(text).toContain("You're receiving this because you have a KNEST account")
      expect(text).toContain('— The team at KNEST')
    }
  })
})

describe('in-app notification body', () => {
  it('is the sentence alone, without the email footer', () => {
    const { body } = applicationStatusChangedTemplate('Founder Launchpad', 'accepted')
    expect(body).toBe("You're in. Welcome to Founder Launchpad.")
    expect(body).not.toContain('receiving this because')
    expect(body).not.toContain('http')
  })
})

describe('emailUrl', () => {
  it('joins without doubling the slash', () => {
    expect(emailUrl('/dashboard')).toMatch(/^https?:\/\/[^/]+\/dashboard$/)
  })
})
