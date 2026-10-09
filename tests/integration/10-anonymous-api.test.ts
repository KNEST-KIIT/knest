import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, createUser, db, get } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'

/**
 * Closing evidence for KN-02 / NF-02: what an anonymous caller can read through
 * the real Payload REST API, served by the production build, backed by a real
 * database that holds real rows (with a sentinel e-mail that must never leak).
 * Lab bookings live in the `app` schema now (no longer in the CMS), so the check
 * is that nothing about them can be reached through any CMS route.
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
  // A real booking, in the application schema, that carries the sentinel identity.
  const sentinelUser = await createUser({ email: SENTINEL_EMAIL, platformRole: 'student' })
  const lab = await db().query("insert into app.labs (id, slug, name, infrastructure_id) values (gen_random_uuid()::text, 'sentinel-lab-app', 'Sentinel Lab', $1) returning id", [space.id])
  await db().query(
    "insert into app.lab_bookings (id, lab_id, user_id, starts_at, ends_at, purpose, headcount) values (gen_random_uuid()::text, $1, $2, now() + interval '1 day', now() + interval '1 day 1 hour', $3, 1)",
    [lab.rows[0].id, sentinelUser, `purpose with ${SENTINEL_USER_ID}`],
  )
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

describe('KN-02: lab bookings are not reachable through the CMS', () => {
  it('the booking really exists, in the application schema (so the absence below is meaningful)', async () => {
    const rows = await db().query('select count(*)::int c from app.lab_bookings b join app.users u on u.id = b.user_id where u.email = $1', [SENTINEL_EMAIL])
    expect(rows.rows[0].c).toBe(1)
  })

  it('the CMS has no lab-bookings route at all, for anonymous callers, whatever they ask', async () => {
    const probes = [
      '/api/lab-bookings',
      `/api/lab-bookings?where[userEmail][equals]=${encodeURIComponent(SENTINEL_EMAIL)}`,
      `/api/lab-bookings?where[userId][equals]=${SENTINEL_USER_ID}`,
      '/api/lab-bookings?depth=2&limit=100&sort=userEmail',
      '/api/lab-bookings/1',
    ]
    for (const p of probes) {
      const res = await get(p)
      const body = await res.text()
      expect(res.status, p).toBe(404)
      expect(body, p).not.toContain(SENTINEL_EMAIL)
      expect(body, p).not.toContain(SENTINEL_USER_ID)
    }
  })

  it('writes to it are refused too', async () => {
    const res = await fetch(`${process.env.TEST_BASE_URL}/api/lab-bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'x', userEmail: 'x@example.test' }),
    })
    expect(res.status).toBe(404)
  })

  it('does not leak through the related-collection join on infrastructure', async () => {
    const res = await get('/api/infrastructure?depth=3&limit=100')
    const body = await res.text()
    expect(body).not.toContain(SENTINEL_EMAIL)
    expect(body).not.toContain(SENTINEL_USER_ID)
  })

  it('the lab booking API needs a sign-in: an anonymous caller gets nothing', async () => {
    for (const p of ['/api/labs/sentinel-lab-app/availability?date=2026-10-12', '/api/labs/report.csv?from=2026-10-01&to=2026-10-31']) {
      const res = await get(p)
      expect(res.status, p).toBe(401)
      expect(await res.text(), p).not.toContain(SENTINEL_EMAIL)
    }
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
