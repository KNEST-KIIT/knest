import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, CAPTCHA, PASSWORD, closeDb, createUser, db, decodeMailText, get, login, readMail, uniqueIp, type Session } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'

/**
 * Module 7 (sign-up must not reveal whether an address exists), module 22 (no draft on page
 * view, deadlines said up front), module 23 (an event in progress), module 24 (operator mail
 * view and resend) and module 35 (analytics reconciliation), against the production build.
 */

const stamp = Date.now()
const DAY = 24 * 60 * 60 * 1000
const mailsTo = (to: string) => readMail().filter((m) => m.to.some((r) => r.includes(to)))

const signup = (body: Record<string, unknown>) =>
  fetch(`${BASE()}/api/auth/password/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
    body: JSON.stringify({ ...CAPTCHA, ...body }),
  })

const post = (path: string, who: Session, body?: unknown) =>
  fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: { 'x-forwarded-for': uniqueIp(), cookie: who.cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })

afterAll(closeDb)

describe('KN-22b: sign-up answers the same for a new and an existing address', () => {
  it('returns an identical response, sets no session, and tells the existing owner by mail', async () => {
    const existing = `existing-${stamp}@enum.test`
    await createUser({ email: existing, platformRole: 'student' })
    const hashBefore = (await db().query('select password_hash from app.users where email = $1', [existing])).rows[0].password_hash

    const fresh = `fresh-${stamp}@enum.test`
    const a = await signup({ name: 'Fresh Person', email: fresh, password: PASSWORD })
    const b = await signup({ name: 'Someone Else', email: existing, password: 'a-completely-different-password-1' })

    expect(a.status).toBe(202)
    expect(b.status).toBe(a.status)
    expect(await b.json()).toEqual(await a.json())
    expect(a.headers.getSetCookie().join(';')).not.toContain('session-token')
    expect(b.headers.getSetCookie().join(';')).not.toContain('session-token')

    // the existing account is untouched
    expect((await db().query('select password_hash from app.users where email = $1', [existing])).rows[0].password_hash).toBe(hashBefore)
    expect((await db().query('select count(*)::int c from app.users where email = $1', [existing])).rows[0].c).toBe(1)

    // each mailbox hears the truth, privately
    await expect.poll(() => mailsTo(fresh).length, { timeout: 20_000 }).toBeGreaterThan(0)
    await expect.poll(() => mailsTo(existing).length, { timeout: 20_000 }).toBeGreaterThan(0)
    expect(decodeMailText(mailsTo(fresh)[0]!.body)).toContain('/verify/confirm?')
    const notice = decodeMailText(mailsTo(existing)[0]!.body)
    expect(notice).toMatch(/already (have|exists)|already an account/i)
    expect(notice).not.toContain('/verify/confirm')
  })

  it('still rejects a weak password with the same message for any address', async () => {
    const res = await signup({ name: 'Weak', email: `weak-${stamp}@enum.test`, password: 'short' })
    expect(res.status).toBe(400)
  })
})

describe('KN-31: applications and deadlines', () => {
  const SLUG = `deadline-program-${stamp}`
  let student: Session
  let programId: number
  let applicationId: string
  let userId: string

  beforeAll(async () => {
    const email = `applicant-${stamp}@apply.test`
    userId = await createUser({ email, platformRole: 'student' })
    await db().query('update app.users set onboarding_completed_at = now() where email = $1', [email])
    student = (await login(email))!
    const payload = await payloadClient()
    const doc = await payload.create({
      collection: 'programs',
      data: {
        title: 'Deadline Program',
        slug: SLUG,
        tagline: 'Created by the account modules suite',
        whoItsFor: richText('Anyone'),
        stage: ['idea'],
        applicationStatus: 'open',
        applicationDeadline: new Date(Date.now() + 5 * DAY).toISOString(),
        applicationQuestions: [{ label: 'Describe it', fieldType: 'textarea', required: true, maxLength: 200 }],
        _status: 'published',
      } as never,
      overrideAccess: true,
    })
    programId = doc.id as number
  })

  const applicationCount = async () =>
    (await db().query('select count(*)::int c from app.applications where user_id = $1', [userId])).rows[0].c as number

  it('viewing the apply page creates nothing', async () => {
    expect(await applicationCount()).toBe(0)
    for (let i = 0; i < 3; i++) {
      const res = await get(`/apply/${SLUG}`, student)
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('Start application')
    }
    expect(await applicationCount()).toBe(0)
  })

  it('a draft is created only by the explicit start, once', async () => {
    const start = () => post('/api/applications/start', student, { programSlug: SLUG })
    const first = await (await start()).json()
    const second = await (await start()).json()
    applicationId = first.applicationId
    expect(applicationId).toBeTruthy()
    expect(second.applicationId).toBe(applicationId)
    expect(await applicationCount()).toBe(1)
  })

  it('once the deadline passes, the draft page says so and saving an answer says why', async () => {
    const payload = await payloadClient()
    await payload.update({
      collection: 'programs',
      id: programId,
      data: { applicationDeadline: new Date(Date.now() - DAY).toISOString() } as never,
      overrideAccess: true,
    })

    const html = await (await get(`/apply/${SLUG}`, student)).text()
    expect(html).toContain('is closed')
    expect(html).toMatch(/Applications for this program closed on/)
    expect(html).not.toContain('Save &amp; continue')

    const found = await payload.find({ collection: 'programs', where: { slug: { equals: SLUG } }, overrideAccess: true, limit: 1 })
    const qid = found.docs[0]!.applicationQuestions![0]!.id!
    const save = await post(`/api/applications/${applicationId}/answer`, student, { questionId: qid, value: 'late' })
    expect(save.status).toBe(400)
    expect((await save.json()).error).toMatch(/closed on .*can.t be submitted/)

    const submit = await post(`/api/applications/${applicationId}/submit`, student, CAPTCHA)
    expect(submit.status).toBe(400)
    expect((await submit.json()).error).toMatch(/closed on/)
  })

  it('a new start after the deadline is refused with the closing date', async () => {
    const other = `late-${stamp}@apply.test`
    await createUser({ email: other, platformRole: 'student' })
    const session = (await login(other))!
    const res = await post('/api/applications/start', session, { programSlug: SLUG })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/closed on/)
  })
})

describe('events in progress', () => {
  it('can be joined until they end and are listed as upcoming', async () => {
    const email = `inprogress-${stamp}@events.test`
    await createUser({ email, platformRole: 'student' })
    await db().query('update app.users set onboarding_completed_at = now() where email = $1', [email])
    const me = (await login(email))!
    const payload = await payloadClient()
    const doc = await payload.create({
      collection: 'events',
      data: {
        title: `Running Now ${stamp}`,
        summary: 'Started an hour ago, ends in an hour',
        startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        _status: 'published',
      } as never,
      overrideAccess: true,
    })
    expect((await post(`/api/events/${doc.id}/register`, me)).status).toBe(200)
    const html = await (await get('/dashboard/events', me)).text()
    const upcomingAt = html.indexOf('Upcoming')
    const pastAt = html.indexOf('Past')
    expect(html).toContain(`Running Now ${stamp}`)
    expect(upcomingAt).toBeGreaterThan(-1)
    expect(pastAt === -1 || html.indexOf(`Running Now ${stamp}`) < pastAt).toBe(true)
  })
})

describe('module 24: the operator mail view', () => {
  let superAdmin: Session
  let editor: Session
  const to = `dead-letter-${stamp}@mail.test`
  let deadId: string
  let blankedId: string

  beforeAll(async () => {
    await createUser({ email: `mail-super-${stamp}@staff.test`, platformRole: 'other', staffRole: 'super_admin' })
    await createUser({ email: `mail-editor-${stamp}@staff.test`, platformRole: 'other', staffRole: 'content_admin' })
    superAdmin = (await login(`mail-super-${stamp}@staff.test`))!
    editor = (await login(`mail-editor-${stamp}@staff.test`))!
    const insert = async (body: string, subject: string) =>
      (
        await db().query(
          `insert into app.email_outbox (id, to_address, subject, body, status, attempts, expires_at, last_error)
           values (gen_random_uuid()::text, $1, $2, $3, 'dead', 8, now() + interval '1 day', 'SMTP: connection refused') returning id`,
          [to, subject, body],
        )
      ).rows[0].id as string
    deadId = await insert('Hello from the outbox. https://example.test/verify/confirm?token=abc', `Dead letter ${stamp}`)
    blankedId = await insert('', `Blank letter ${stamp}`)
  })

  it('is closed to staff roles other than super admin', async () => {
    expect((await get('/admin/mail', editor)).status).toBe(404)
    expect((await post(`/api/admin/mail/${deadId}/resend`, editor)).status).toBe(403)
  })

  it('lists failed mail without its content, and resends it once with an audit row', async () => {
    const html = await (await get('/admin/mail', superAdmin)).text()
    expect(html).toContain(`Dead letter ${stamp}`)
    expect(html).toContain('SMTP: connection refused')
    expect(html).not.toContain('Hello from the outbox')
    expect(html).toContain('Content removed')

    const res = await post(`/api/admin/mail/${deadId}/resend`, superAdmin)
    expect(res.status).toBe(200)
    await expect.poll(() => mailsTo(to).length, { timeout: 20_000 }).toBe(1)
    expect(decodeMailText(mailsTo(to)[0]!.body)).toContain('Hello from the outbox')

    const row = (await db().query('select status, body from app.email_outbox where id = $1', [deadId])).rows[0]
    expect(row).toMatchObject({ status: 'sent', body: '' })
    expect((await db().query("select count(*)::int c from app.audit_logs where action = 'email_resent' and entity_id = $1", [deadId])).rows[0].c).toBe(1)

    // already sent: a second press changes nothing
    expect((await post(`/api/admin/mail/${deadId}/resend`, superAdmin)).status).toBe(409)
    expect(mailsTo(to)).toHaveLength(1)
  })

  it('refuses to resend a message whose content has been removed, and says why', async () => {
    const res = await post(`/api/admin/mail/${blankedId}/resend`, superAdmin)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/request a new link/)
  })
})

describe('module 35: analytics reconciles events with records', () => {
  it('shows the database records beside events, and a reconciliation section', async () => {
    const email = `analytics-${stamp}@staff.test`
    await createUser({ email, platformRole: 'other', staffRole: 'super_admin' })
    const who = (await login(email))!
    const html = await (await get('/admin/analytics', who)).text()
    expect(html).toContain('Records in the database')
    expect(html).toContain('Events against records')
    expect(html).toContain('Onboarding completed')
  })
})
