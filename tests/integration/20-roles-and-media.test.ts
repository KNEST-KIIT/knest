import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, createUser, get, login, uniqueIp, BASE, type Session } from '../support/helpers'
import { PNG_1X1, payloadClient } from '../support/payload'

/**
 * Closing evidence for KN-02 / NF-03 / KN-22j: role-based authorisation at the
 * real boundary. Each user signs in through the real login route and uses the
 * real session cookie against the production build.
 */

const ROLES = ['reviewer', 'content_admin', 'program_manager', 'startup_manager', 'mentor_manager', 'lab_admin', 'super_admin'] as const
type Role = (typeof ROLES)[number]
const sessions = {} as Record<Role | 'student', Session>

beforeAll(async () => {
  for (const role of ROLES) {
    await createUser({ email: `${role}@roles.test`, platformRole: 'other', staffRole: role })
    const s = await login(`${role}@roles.test`)
    if (!s) throw new Error(`could not sign in as ${role}`)
    sessions[role] = s
  }
  await createUser({ email: 'student@roles.test', platformRole: 'student' })
  const s = await login('student@roles.test')
  if (!s) throw new Error('could not sign in as student')
  sessions.student = s

})

afterAll(closeDb)

describe('lab-bookings: no longer a CMS collection (KN-02)', () => {
  it.each(['reviewer', 'content_admin', 'program_manager', 'startup_manager', 'mentor_manager', 'lab_admin', 'super_admin', 'student'] as const)(
    'there is nothing to read for %s',
    async (who) => {
      const res = await get('/api/lab-bookings', sessions[who])
      expect(res.status, who).toBe(404)
    },
  )
})

describe('the Payload admin renders on the upgraded stack', () => {
  it('is a 404 for anonymous visitors and for a signed-in student', async () => {
    expect((await get('/admin')).status).toBe(404)
    expect((await get('/admin', sessions.student)).status).toBe(404)
  })

  it.each(['reviewer', 'content_admin', 'super_admin'] as const)('loads for %s', async (role) => {
    const res = await get('/admin', sessions[role])
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html.length).toBeGreaterThan(5000)
  })

  it('unlock is not available, even to a super admin (GHSA-jg8r-5jh2-v2xj)', async () => {
    const res = await fetch(`${BASE()}/api/staff/unlock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: sessions.super_admin.cookie },
      body: JSON.stringify({ email: 'reviewer@roles.test' }),
    })
    expect(res.status).not.toBe(200)
  })
})

function upload(bytes: Buffer, filename: string, type: string, session: Session) {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(bytes)], { type }), filename)
  form.append('_payload', JSON.stringify({ alt: 'integration test image' }))
  return fetch(`${BASE()}/api/media`, {
    method: 'POST',
    headers: { cookie: session.cookie, 'x-forwarded-for': uniqueIp() },
    body: form,
  })
}

describe('media: who can upload, and what (NF-03, KN-22j)', () => {
  it('refuses anonymous uploads', async () => {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(PNG_1X1)], { type: 'image/png' }), 'anon.png')
    form.append('_payload', JSON.stringify({ alt: 'x' }))
    const res = await fetch(`${BASE()}/api/media`, { method: 'POST', body: form })
    expect([401, 403]).toContain(res.status)
  })

  it.each(['reviewer', 'program_manager', 'startup_manager', 'mentor_manager', 'lab_admin'] as const)('refuses %s', async (role) => {
    const res = await upload(PNG_1X1, `${role}.png`, 'image/png', sessions[role])
    expect([401, 403], `${role} got ${res.status}`).toContain(res.status)
  })

  it.each(['content_admin', 'super_admin'] as const)('allows %s to upload an image, and sharp resizes it', async (role) => {
    const res = await upload(PNG_1X1, `${role}.png`, 'image/png', sessions[role])
    const text = await res.text()
    expect(res.status, text.slice(0, 300)).toBe(201)
    const doc = JSON.parse(text).doc
    expect(doc.mimeType).toBe('image/png')
    expect(doc.sizes).toBeTruthy()
  })

  it('rejects an SVG even from a super admin', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    const res = await upload(svg, 'evil.svg', 'image/svg+xml', sessions.super_admin)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects HTML and XML payloads', async () => {
    for (const [name, type, body] of [
      ['page.html', 'text/html', '<script>alert(1)</script>'],
      ['data.xml', 'application/xml', '<?xml version="1.0"?><a/>'],
    ] as const) {
      const res = await upload(Buffer.from(body), name, type, sessions.super_admin)
      expect(res.status, name).toBeGreaterThanOrEqual(400)
    }
  })

  it('a reviewer cannot replace or delete existing media either', async () => {
    const created = await upload(PNG_1X1, 'to-protect.png', 'image/png', sessions.content_admin)
    const id = JSON.parse(await created.text()).doc.id
    const del = await fetch(`${BASE()}/api/media/${id}`, { method: 'DELETE', headers: { cookie: sessions.reviewer.cookie } })
    expect([401, 403]).toContain(del.status)
    const patch = await fetch(`${BASE()}/api/media/${id}`, {
      method: 'PATCH',
      headers: { cookie: sessions.reviewer.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ alt: 'defaced' }),
    })
    expect([401, 403]).toContain(patch.status)
  })
})
