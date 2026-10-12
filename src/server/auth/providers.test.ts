import { describe, expect, it } from 'vitest'
import { authProviders, googleConfigured } from './providers'

describe('googleConfigured', () => {
  it('is off with nothing set', () => {
    expect(googleConfigured({})).toBe(false)
  })
  it('is off when only half of the credential is set', () => {
    expect(googleConfigured({ AUTH_GOOGLE_ID: 'id' })).toBe(false)
    expect(googleConfigured({ AUTH_GOOGLE_SECRET: 'secret' })).toBe(false)
  })
  it('is off for empty or blank values, which is how a test server and a copied .env look', () => {
    expect(googleConfigured({ AUTH_GOOGLE_ID: '', AUTH_GOOGLE_SECRET: '' })).toBe(false)
    expect(googleConfigured({ AUTH_GOOGLE_ID: '  ', AUTH_GOOGLE_SECRET: 'secret' })).toBe(false)
  })
  it('is on when both are present', () => {
    expect(googleConfigured({ AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: 'secret' })).toBe(true)
  })
})

describe('authProviders', () => {
  it('has no provider when Google is not configured', () => {
    expect(authProviders({})).toEqual([])
  })

  it('adds Google, with stub credentials, when configured', () => {
    const providers = authProviders({ AUTH_GOOGLE_ID: 'stub-id', AUTH_GOOGLE_SECRET: 'stub-secret' })
    expect(providers).toHaveLength(1)
  })

  it('points discovery at another issuer when one is given, with the stub credentials', () => {
    const [provider] = authProviders({
      AUTH_GOOGLE_ID: 'stub-id',
      AUTH_GOOGLE_SECRET: 'stub-secret',
      AUTH_GOOGLE_ISSUER: 'http://127.0.0.1:9999',
    })
    // Auth.js keeps what the caller passed under `options` and merges it over the defaults.
    expect(provider).toMatchObject({
      id: 'google',
      options: { issuer: 'http://127.0.0.1:9999', clientId: 'stub-id', clientSecret: 'stub-secret' },
    })
  })
})
