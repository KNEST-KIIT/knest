import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CAPTCHA, BASE, closeDb, createUser, get, login, uniqueIp, type Session } from '../support/helpers'

/**
 * Closing evidence for the application half of the edge design: what the origin
 * says about caching, the health endpoint, and refusal of cross-origin writes.
 * (The CloudFront and WAF half is verified against the real distribution.)
 */

const stamp = Date.now()
let member: Session
let staff: Session

beforeAll(async () => {
  await createUser({ email: `member-${stamp}@edge.test`, platformRole: 'student' })
  await createUser({ email: `staff-${stamp}@edge.test`, platformRole: 'other', staffRole: 'program_manager' })
  member = (await login(`member-${stamp}@edge.test`))!
  staff = (await login(`staff-${stamp}@edge.test`))!
})
afterAll(closeDb)

describe('private responses are never cacheable by a shared cache', () => {
  const cases: [string, () => Session | null][] = [
    ['/login', () => null],
    ['/signup', () => null],
    ['/verify', () => null],
    ['/dashboard', () => null], // redirect to login
    ['/dashboard/applications', () => member],
    ['/apply/anything', () => member],
    ['/admin', () => staff],
    ['/admin/applications', () => staff],
    ['/api/auth/session', () => member],
    ['/api/lab-bookings?limit=0', () => null],
    ['/api/health', () => null],
  ]
  it.each(cases)('%s', async (path, who) => {
    const res = await get(path, who())
    const cacheControl = (res.headers.get('cache-control') ?? '').toLowerCase()
    expect(cacheControl, `${path} -> ${res.status}`).toContain('no-store')
    expect(cacheControl).not.toMatch(/public|s-maxage/)
  })
})

describe('health endpoint', () => {
  it('reports ok with no detail, without a session', async () => {
    const res = await get('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('cross-origin writes are refused before any route code runs', () => {
  const login = (origin: string | null) =>
    fetch(`${BASE()}/api/auth/password/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp(), ...(origin ? { origin } : {}) },
      body: JSON.stringify({ email: 'nobody@edge.test', password: 'wrong-password-123', ...CAPTCHA }),
    })

  it.each(['https://evil.example', 'null', 'http://127.0.0.1:1'])('Origin %s -> 403', async (origin) => {
    const res = await login(origin)
    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Forbidden')
  })

  it('the site’s own origin, and no Origin at all, reach the route', async () => {
    const own = await login(new URL(BASE()).origin)
    const none = await login(null)
    expect(own.status).not.toBe(403)
    expect(none.status).not.toBe(403)
  })
})
