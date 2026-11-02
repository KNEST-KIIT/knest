import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, createUser, db, get, login, uniqueIp, type Session } from '../support/helpers'

/**
 * Erasing a person without erasing the organisation's records: the account is anonymised, the application records
 * and the audit trail stay, and nothing that identifies the person or lets them back in survives.
 */

const stamp = Date.now()
const email = (n: string) => `${n}-${stamp}@anon.test`

let superAdmin: Session
let reviewer: Session
let member: Session
let memberId: string
let superId: string

const post = (path: string, session: Session | null, body: unknown) =>
  fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp(), origin: new URL(BASE()).origin, ...(session ? { cookie: session.cookie } : {}) },
    body: JSON.stringify(body),
  })

const userRow = async (id: string) => (await db().query('select email, name, password_hash, is_active, bio from app.users where id = $1', [id])).rows[0] as { email: string; name: string; password_hash: string | null; is_active: boolean; bio: string | null }
const count = async (sql: string, params: unknown[]) => (await db().query(sql, params)).rows[0].c as number

beforeAll(async () => {
  superId = await createUser({ email: email('super'), platformRole: 'other', staffRole: 'super_admin' })
  await createUser({ email: email('reviewer'), platformRole: 'other', staffRole: 'reviewer' })
  memberId = await createUser({ email: email('member') })
  superAdmin = (await login(email('super')))!
  reviewer = (await login(email('reviewer')))!
  member = (await login(email('member')))!
  await db().query("update app.users set bio = 'A private biography', school = 'KIIT', skills = '{python,design}' where id = $1", [memberId])
  const app = await db().query("insert into app.applications (id, user_id, program_id, status) values (gen_random_uuid()::text, $1, 987654, 'submitted') returning id", [memberId])
  await db().query("insert into app.application_answers (id, application_id, question_id, value) values (gen_random_uuid()::text, $1, 'q1', to_jsonb('My own typed answer'::text))", [app.rows[0].id])
  await db().query("insert into app.enquiries (id, name, email, topic, message, user_id) values (gen_random_uuid()::text, 'Real Name', $1, 'general', 'a message with private details', $2)", [email('member'), memberId])
  await db().query("insert into app.notifications (id, user_id, type, title, body) values (gen_random_uuid()::text, $1, 'application_received', 'Hello', 'Body')", [memberId])
})
afterAll(closeDb)

describe('anonymising a member', () => {
  it('is for super administrators only, and asks for the address back as confirmation', async () => {
    expect((await post(`/api/admin/members/${memberId}/anonymise`, null, { confirmEmail: email('member') })).status).toBe(401)
    expect((await post(`/api/admin/members/${memberId}/anonymise`, reviewer, { confirmEmail: email('member') })).status).toBe(403)
    expect((await post(`/api/admin/members/${memberId}/anonymise`, member, { confirmEmail: email('member') })).status).toBe(403)

    expect((await post(`/api/admin/members/${memberId}/anonymise`, superAdmin, {})).status).toBe(400)
    expect((await post(`/api/admin/members/${memberId}/anonymise`, superAdmin, { confirmEmail: 'someone-else@anon.test' })).status).toBe(400)
    expect((await post(`/api/admin/members/${memberId}/anonymise`, superAdmin, { confirmEmail: email('member'), scrubApplicationContent: 'yes' })).status).toBe(400)
    expect((await userRow(memberId)).name).not.toBe('Former member')
  })

  it('refuses to anonymise yourself, or a staff account', async () => {
    expect((await post(`/api/admin/members/${superId}/anonymise`, superAdmin, { confirmEmail: email('super') })).status).toBe(400)
    const staffId = (await db().query('select id from app.users where email = $1', [email('reviewer')])).rows[0].id as string
    const res = await post(`/api/admin/members/${staffId}/anonymise`, superAdmin, { confirmEmail: email('reviewer') })
    expect(res.status).toBe(400)
    expect((await userRow(staffId)).name).not.toBe('Former member')
  })

  it('removes the identity and every way back in, and keeps the records', async () => {
    expect(await count('select count(*)::int c from app.sessions where user_id = $1', [memberId])).toBeGreaterThan(0)

    const res = await post(`/api/admin/members/${memberId}/anonymise`, superAdmin, { confirmEmail: email('member') })
    expect(res.status, await res.clone().text()).toBe(200)

    const row = await userRow(memberId)
    expect(row.name).toBe('Former member')
    expect(row.email).toBe(`anonymised-${memberId}@anonymised.invalid`)
    expect(row.password_hash).toBeNull()
    expect(row.is_active).toBe(false)
    expect(row.bio).toBeNull()

    // nothing that signs them in or reaches them
    expect(await count('select count(*)::int c from app.sessions where user_id = $1', [memberId])).toBe(0)
    expect(await count('select count(*)::int c from app.notifications where user_id = $1', [memberId])).toBe(0)
    expect(await login(email('member'))).toBeNull()
    expect(JSON.stringify(await (await get('/api/auth/session', member)).text())).not.toContain('Former')

    // the contact-form message loses who wrote it and what it said
    const enquiry = (await db().query('select name, email, message from app.enquiries where user_id = $1', [memberId])).rows[0]
    expect(enquiry).toMatchObject({ name: 'Former member', message: '[removed on request]' })
    expect(enquiry.email).not.toContain(email('member'))

    // the organisation's records stay: the application, and its answer (retention is the default)
    expect(await count('select count(*)::int c from app.applications where user_id = $1', [memberId])).toBe(1)
    expect(await count("select count(*)::int c from app.application_answers where value = to_jsonb('My own typed answer'::text)", [])).toBeGreaterThanOrEqual(1)

    // the audit entry records who and which choice, and never the old address
    const audit = (await db().query("select actor_user_id, after from app.audit_logs where action = 'account_anonymised' and entity_id = $1", [memberId])).rows[0]
    expect(audit.actor_user_id).toBe(superId)
    expect(audit.after).toEqual({ scrubApplicationContent: false })
    expect(JSON.stringify(audit)).not.toContain(email('member'))
  })

  it('is safe to repeat, and can also remove the applicant’s answers when asked', async () => {
    const again = await post(`/api/admin/members/${memberId}/anonymise`, superAdmin, { confirmEmail: `anonymised-${memberId}@anonymised.invalid` })
    expect(again.status).toBe(200)

    const other = await createUser({ email: email('scrub') })
    const app = await db().query("insert into app.applications (id, user_id, program_id, status) values (gen_random_uuid()::text, $1, 987655, 'submitted') returning id", [other])
    await db().query("insert into app.application_answers (id, application_id, question_id, value) values (gen_random_uuid()::text, $1, 'q1', to_jsonb('Typed text to be removed'::text))", [app.rows[0].id])
    const res = await post(`/api/admin/members/${other}/anonymise`, superAdmin, { confirmEmail: email('scrub'), scrubApplicationContent: true })
    expect(res.status, await res.clone().text()).toBe(200)
    expect(await count('select count(*)::int c from app.applications where user_id = $1', [other])).toBe(1)
    expect(await count("select count(*)::int c from app.application_answers where application_id = $1 and value = to_jsonb('[removed on request]'::text)", [app.rows[0].id])).toBe(1)
    expect(await count("select count(*)::int c from app.application_answers where application_id = $1 and value = to_jsonb('Typed text to be removed'::text)", [app.rows[0].id])).toBe(0)
  })
})
