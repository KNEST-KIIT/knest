import { describe, expect, it } from 'vitest'
import { verifiedGoogleEmail } from './google-profile'
import { signInDestination } from './destination'

describe('Google identity boundary', () => {
  it('requires a verified email and stable subject', () => {
    expect(verifiedGoogleEmail({ sub: 'google-person', email: ' Person@Example.com ', email_verified: true })).toBe('person@example.com')
    for (const profile of [undefined, {}, { sub: 's', email: 'a@b.com' },
      { sub: 's', email: 'a@b.com', email_verified: 'true' },
      { sub: '', email: 'a@b.com', email_verified: true },
      { sub: 's', email: 'invalid', email_verified: true }]) {
      expect(verifiedGoogleEmail(profile)).toBeNull()
    }
  })
})

describe('shared sign-in destination', () => {
  it('takes new members to onboarding and returning members to their dashboard', () => {
    expect(signInDestination({ onboardingComplete: false })).toBe('/onboarding')
    expect(signInDestination({ onboardingComplete: true })).toBe('/dashboard')
  })
  it('takes assigned staff directly to an area they can use, regardless of onboarding', () => {
    expect(signInDestination({ staffRole: 'reviewer', onboardingComplete: false })).toBe('/admin/applications')
    expect(signInDestination({ staffRole: 'super_admin', onboardingComplete: false })).toBe('/admin/overview')
    expect(signInDestination({ staffRole: 'mentor_manager', onboardingComplete: true })).toBe('/admin/collections/mentors')
  })
})
