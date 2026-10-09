import { describe, expect, it } from 'vitest'
import { allowedOrigins, guardRequest } from './edge-guard'

const headers = (h: Record<string, string>) => (name: string) => h[name.toLowerCase()] ?? null
const SECRET = 's'.repeat(40)
const env = { ORIGIN_VERIFY_SECRET: SECRET, SITE_URL: 'https://kiitnest.com' }

describe('origin verification (production sits behind CloudFront)', () => {
  it('refuses a request that did not come through the distribution', () => {
    const d = guardRequest({ method: 'GET', pathname: '/', header: headers({}) }, env)
    expect(d).toEqual({ allow: false, status: 403, reason: 'origin-verify' })
  })

  it('refuses a wrong secret, including one of the right length', () => {
    expect(guardRequest({ method: 'GET', pathname: '/', header: headers({ 'x-origin-verify': 'x'.repeat(40) }) }, env).allow).toBe(false)
    expect(guardRequest({ method: 'GET', pathname: '/', header: headers({ 'x-origin-verify': 'short' }) }, env).allow).toBe(false)
  })

  it('accepts the right secret', () => {
    expect(guardRequest({ method: 'GET', pathname: '/dashboard', header: headers({ 'x-origin-verify': SECRET }) }, env)).toEqual({ allow: true })
  })

  it('leaves only the health check open, which does not pass through CloudFront', () => {
    expect(guardRequest({ method: 'GET', pathname: '/api/health', header: headers({}) }, env)).toEqual({ allow: true })
    expect(guardRequest({ method: 'GET', pathname: '/api/healthz', header: headers({}) }, env).allow).toBe(false)
  })

  it('is off when no secret is configured (development, tests)', () => {
    expect(guardRequest({ method: 'GET', pathname: '/', header: headers({}) }, { SITE_URL: 'http://localhost:3000' })).toEqual({ allow: true })
  })
})

describe('same-origin writes', () => {
  const sameSite = { SITE_URL: 'https://kiitnest.com' }
  it('refuses a write that names another origin, or the opaque origin', () => {
    for (const origin of ['https://evil.example', 'null', 'https://kiitnest.com.evil.example', 'http://kiitnest.com']) {
      expect(guardRequest({ method: 'POST', pathname: '/api/x', header: headers({ origin }) }, sameSite).allow, origin).toBe(false)
    }
  })

  it('accepts the site itself and configured extras; reads are never checked', () => {
    expect(guardRequest({ method: 'POST', pathname: '/api/x', header: headers({ origin: 'https://kiitnest.com' }) }, sameSite).allow).toBe(true)
    expect(guardRequest({ method: 'DELETE', pathname: '/api/x', header: headers({ origin: 'https://d1.cloudfront.net' }) }, { ...sameSite, ALLOWED_ORIGINS: 'https://d1.cloudfront.net, not a url' }).allow).toBe(true)
    expect(guardRequest({ method: 'GET', pathname: '/api/x', header: headers({ origin: 'https://evil.example' }) }, sameSite).allow).toBe(true)
  })

  it('allows a write with no Origin header (non-browser clients) and is inactive without a configured site', () => {
    expect(guardRequest({ method: 'POST', pathname: '/api/x', header: headers({}) }, sameSite).allow).toBe(true)
    expect(guardRequest({ method: 'POST', pathname: '/api/x', header: headers({ origin: 'https://evil.example' }) }, {}).allow).toBe(true)
  })

  it('normalises the configured addresses', () => {
    expect([...allowedOrigins({ SITE_URL: 'https://kiitnest.com/path?x=1', ALLOWED_ORIGINS: 'https://a.example/' })]).toEqual(['https://kiitnest.com', 'https://a.example'])
  })
})
