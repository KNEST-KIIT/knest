import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, createUser, db, get, login, uniqueIp, type Session } from '../support/helpers'

/**
 * Closing evidence for KN-10 / R-03: a deactivated account loses the sessions it
 * already holds, on its very next request, through every path that reads a
 * session; role changes revoke sessions; only a super admin can do either; both
 * are audited. Real login, real cookies, real database.
 */

const stamp = Date.now()
const email = (n: string) => `${n}-${stamp}@member.test`

let superAdmin: Session
let reviewer: Session

beforeAll(async () => {
  await createUser({ email: email('super'), platformRole: 'other', staffRole: 'super_admin' })
  await createUser({ email: email('reviewer'), platformRole: 'other', staffRole: 'reviewer' })
  superAdmin = (await login(email('super')))!
  reviewer = (await login(email('reviewer')))!
})
afterAll(closeDb)

const post = (path: string, session: Session | null, body: unknown) =>
  fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': uniqueIp(),
      ...(session ? { cookie: session.cookie } : {}),
    },
    body: JSON.stringify(body),
  })

const idOf = async (mail: string) => (await db().query('select id from app.users where email = $1', [mail])).rows[0].id as string
const sessionBody = async (s: Session) => (await (await get('/api/auth/session', s)).text()).trim()
const sessionRows = async (id: string) => (await db().query('select count(*)::int c from app.sessions where user_id = $1', [id])).rows[0].c as number

describe('deactivating an account (KN-10)', () => {
  it('kills a session that already exists, on the very next request', async () => {
    const mail = email('student')
    const id = await createUser({ email: mail, platformRole: 'student' })
    const victim = (await login(mail))!
    expect(await sessionBody(victim)).toContain(mail) // the session is live
    expect((await get('/dashboard/applications', victim)).status).toBe(200)
    expect(await sessionRows(id)).toBe(1)

    const res = await post(`/api/admin/members/${id}/active`, superAdmin, { isActive: false })
    expect(res.status).toBe(200)

    // the same cookie, nothing else changed
    expect(await sessionBody(victim)).toBe('null')
    expect(await sessionRows(id)).toBe(0)
    const page = await get('/dashboard/applications', victim)
    expect(page.status).toBe(307)
    expect(page.headers.get('location')).toContain('/login')

    const audit = await db().query(
      "select actor_user_id, before, after from app.audit_logs where action = 'account_deactivated' and entity_id = $1",
      [id],
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].before).toEqual({ isActive: true })
    expect(audit.rows[0].after).toEqual({ isActive: false })
  })

  it('cannot sign back in while deactivated, and reactivation does not resurrect the old session', async () => {
    const mail = email('student2')
    const id = await createUser({ email: mail, platformRole: 'student' })
    const old = (await login(mail))!
    await post(`/api/admin/members/${id}/active`, superAdmin, { isActive: false })
    expect(await login(mail)).toBeNull()

    expect((await post(`/api/admin/members/${id}/active`, superAdmin, { isActive: true })).status).toBe(200)
    expect(await sessionBody(old)).toBe('null') // the old cookie stays dead
    expect(await login(mail)).not.toBeNull() // a fresh login works
  })

  it('removes a deactivated staff member from /admin and from the Payload API', async () => {
    const mail = email('editor')
    const id = await createUser({ email: mail, platformRole: 'other', staffRole: 'content_admin' })
    const editor = (await login(mail))!
    expect((await get('/admin', editor)).status).toBe(200)
    expect((await get('/api/media?limit=1', editor)).status).toBe(200)
    const before = await (await fetch(`${BASE()}/api/staff/me`, { headers: { cookie: editor.cookie } })).json()
    expect(before.user).toBeTruthy()

    await post(`/api/admin/members/${id}/active`, superAdmin, { isActive: false })
    expect((await get('/admin', editor)).status).toBe(404)
    // Payload's own view of who is signed in: the editor is gone, not merely refused one route.
    const who = await (await fetch(`${BASE()}/api/staff/me`, { headers: { cookie: editor.cookie } })).json()
    expect(who.user ?? null).toBeNull()
  })
})

describe('changing a staff role (KN-10)', () => {
  it('revokes the person’s sessions and is audited', async () => {
    const mail = email('promoted')
    const id = await createUser({ email: mail, platformRole: 'other', staffRole: 'reviewer' })
    const old = (await login(mail))!
    expect(await sessionBody(old)).toContain(mail)

    const res = await post(`/api/admin/members/${id}/staff-role`, superAdmin, { staffRole: 'content_admin' })
    expect(res.status).toBe(200)
    expect(await sessionBody(old)).toBe('null')
    expect((await db().query('select staff_role from app.users where id = $1', [id])).rows[0].staff_role).toBe('content_admin')
    const audit = await db().query("select before, after from app.audit_logs where action = 'staff_role_changed' and entity_id = $1", [id])
    expect(audit.rows[0].before).toEqual({ staffRole: 'reviewer' })
    expect(audit.rows[0].after).toEqual({ staffRole: 'content_admin' })
  })

  it('removing staff access (null) takes the person out of the console', async () => {
    const mail = email('demoted')
    const id = await createUser({ email: mail, platformRole: 'other', staffRole: 'content_admin' })
    const s = (await login(mail))!
    expect((await get('/admin', s)).status).toBe(200)
    expect((await post(`/api/admin/members/${id}/staff-role`, superAdmin, { staffRole: null })).status).toBe(200)
    const again = (await login(mail))!
    expect((await get('/admin', again)).status).toBe(404)
  })
})

describe('who may do this', () => {
  it('refuses anonymous callers, reviewers and ordinary members', async () => {
    const target = await createUser({ email: email('target'), platformRole: 'student' })
    const student = (await login(email('target')))!
    for (const who of [null, reviewer, student]) {
      const a = await post(`/api/admin/members/${target}/active`, who, { isActive: false })
      const b = await post(`/api/admin/members/${target}/staff-role`, who, { staffRole: 'super_admin' })
      expect([401, 403, 404], 'active').toContain(a.status)
      expect([401, 403, 404], 'staff-role').toContain(b.status)
    }
    expect((await db().query('select is_active, staff_role from app.users where id = $1', [target])).rows[0]).toEqual({
      is_active: true,
      staff_role: null,
    })
  })

  it('a super admin cannot change their own account or role (no lock-out)', async () => {
    const me = await idOf(email('super'))
    expect((await post(`/api/admin/members/${me}/active`, superAdmin, { isActive: false })).status).toBe(400)
    expect((await post(`/api/admin/members/${me}/staff-role`, superAdmin, { staffRole: 'reviewer' })).status).toBe(400)
    expect(await sessionBody(superAdmin)).toContain(email('super'))
  })

  it('validates input strictly', async () => {
    const id = await idOf(email('reviewer'))
    expect((await post(`/api/admin/members/${id}/active`, superAdmin, { isActive: 'false' })).status).toBe(400)
    expect((await post(`/api/admin/members/${id}/active`, superAdmin, {})).status).toBe(400)
    expect((await post(`/api/admin/members/${id}/staff-role`, superAdmin, { staffRole: 'wizard' })).status).toBe(400)
    expect((await post(`/api/admin/members/${id}/staff-role`, superAdmin, { staffRole: 7 })).status).toBe(400)
    expect((await post('/api/admin/members/does-not-exist/active', superAdmin, { isActive: false })).status).toBe(400)
  })
})
