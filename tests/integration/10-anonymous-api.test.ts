import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, get } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'

/**
 * Closing evidence for KN-02 / NF-02: what an anonymous caller can read through
 * the real Payload REST API, served by the production build, backed by a real
 * database that holds real rows (with a sentinel e-mail that must never leak).
 */

const SENTINEL_EMAIL = 'sentinel.student.pii@example.test'
const SENTINEL_USER_ID = 'sentinel-user-id-0001'
const SENTINEL_SOURCE = 'sentinel-internal-source-note'

beforeAll(async () => {
  const payload = await payloadClient()
  const space = await payload.create({
    collection: 'infrastructure',
    data: { name: 'Sentinel Lab', slug: 'sentinel-lab', _status: 'published' } as never,
    overrideAccess: true,
  })
  await payload.create({
    collection: 'lab-bookings',
    data: {
      infrastructure: space.id,
      userId: SENTINEL_USER_ID,
      userEmail: SENTINEL_EMAIL,
      startTime: new Date(Date.now() + 86_400_000).toISOString(),
      endTime: new Date(Date.now() + 90_000_000).toISOString(),
      status: 'pending',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'metrics',
    data: { label: 'Sentinel metric', value: '1', asOf: new Date().toISOString(), source: SENTINEL_SOURCE },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'programs',
    data: {
      title: 'Draft Only Program',
      slug: 'draft-only-program',
      tagline: 'never public',
      whoItsFor: richText('x'),
      stage: ['idea'],
      applicationStatus: 'open',
      _status: 'draft',
    } as never,
    overrideAccess: true,
    draft: true,
  })
})

afterAll(closeDb)

describe('KN-02: anonymous access to lab bookings', () => {
  it('the row really exists (so the denial below is meaningful)', async () => {
    const payload = await payloadClient()
    const found = await payload.find({ collection: 'lab-bookings', overrideAccess: true })
    expect(found.totalDocs).toBe(1)
    expect(found.docs[0]?.userEmail).toBe(SENTINEL_EMAIL)
  })

  it('GET /api/lab-bookings is refused and leaks nothing', async () => {
    const res = await get('/api/lab-bookings')
    const body = await res.text()
    expect([401, 403]).toContain(res.status)
    expect(body).not.toContain(SENTINEL_EMAIL)
    expect(body).not.toContain(SENTINEL_USER_ID)
  })

  it('cannot probe the hidden fields with a query filter either', async () => {
    const probes = [
      `/api/lab-bookings?where[userEmail][equals]=${encodeURIComponent(SENTINEL_EMAIL)}`,
      `/api/lab-bookings?where[userEmail][like]=sentinel`,
      `/api/lab-bookings?where[userId][equals]=${SENTINEL_USER_ID}`,
      `/api/lab-bookings?depth=2&limit=100&sort=userEmail`,
      `/api/lab-bookings/1`,
    ]
    for (const p of probes) {
      const res = await get(p)
      const body = await res.text()
      expect(body, p).not.toContain(SENTINEL_EMAIL)
      expect(body, p).not.toContain(SENTINEL_USER_ID)
      expect(res.status, p).not.toBe(200)
    }
  })

  it('writes are refused for anonymous callers', async () => {
    const res = await fetch(`${process.env.TEST_BASE_URL}/api/lab-bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'x', userEmail: 'x@example.test', startTime: new Date().toISOString(), endTime: new Date().toISOString(), infrastructure: 1 }),
    })
    expect([401, 403]).toContain(res.status)
  })

  it('does not leak through the related-collection join on infrastructure', async () => {
    const res = await get('/api/infrastructure?depth=3&limit=100')
    expect(await res.text()).not.toContain(SENTINEL_EMAIL)
  })
})

describe('NF-02: internal fields on public collections', () => {
  it('metrics are public but the internal source note is not', async () => {
    const res = await get('/api/metrics?depth=0')
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('Sentinel metric')
    expect(body).not.toContain(SENTINEL_SOURCE)
  })

  it('cannot probe the hidden source field with a filter', async () => {
    const res = await get(`/api/metrics?where[source][equals]=${SENTINEL_SOURCE}`)
    const body = await res.text()
    expect(body).not.toContain(SENTINEL_SOURCE)
    if (res.status === 200) expect(JSON.parse(body).totalDocs).toBe(0)
  })
})

describe('draft content stays private', () => {
  it('an unpublished program is invisible to anonymous callers', async () => {
    const list = await (await get('/api/programs?depth=0')).text()
    expect(list).not.toContain('Draft Only Program')
    // The page streams (loading.tsx), so Next answers 200 even when it then renders
    // the not-found UI. What must hold is that nothing of the draft is in the HTML.
    const page = await get('/programs/draft-only-program')
    const html = await page.text()
    expect(html).not.toContain('Draft Only Program')
    expect(html).not.toContain('never public')
  })
})

describe('staff mirror', () => {
  it('is not readable anonymously', async () => {
    const res = await get('/api/staff')
    expect([401, 403]).toContain(res.status)
  })
})
