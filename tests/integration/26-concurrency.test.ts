import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CAPTCHA, BASE, closeDb, createUser, db, get, login, uniqueIp, type Session } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'

/**
 * Closing evidence for R-04 / R-05: the invariants that used to hold only when
 * requests arrived one at a time. Each test fires genuinely parallel requests at
 * the production build and checks the database afterwards.
 */

const stamp = Date.now()
const email = (n: string) => `${n}-${stamp}@conc.test`
const DAY = 24 * 60 * 60 * 1000

const post = (path: string, session: Session | null, body?: unknown) =>
  fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': uniqueIp(),
      ...(session ? { cookie: session.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

let staffA: Session
let staffB: Session
let programId: number
let programSlug: string
let questionId: string

async function makeEvent(data: Record<string, unknown>) {
  const payload = await payloadClient()
  const doc = await payload.create({
    collection: 'events',
    data: {
      title: `Conc event ${Math.random()}`,
      summary: 'Created by the concurrency suite',
      startsAt: new Date(Date.now() + 5 * DAY).toISOString(),
      _status: 'published',
      ...data,
    } as never,
    overrideAccess: true,
  })
  return doc.id as number
}

async function submittedApplication(tag: string) {
  const userId = await createUser({ email: email(tag), platformRole: 'student' })
  const res = await db().query(
    `insert into app.applications (id, user_id, program_id, status, submitted_at)
     values (gen_random_uuid()::text, $1, $2, 'submitted', now()) returning id`,
    [userId, programId],
  )
  return { userId, applicationId: res.rows[0].id as string }
}

beforeAll(async () => {
  await createUser({ email: email('staff-a'), platformRole: 'other', staffRole: 'program_manager' })
  await createUser({ email: email('staff-b'), platformRole: 'other', staffRole: 'program_manager' })
  staffA = (await login(email('staff-a')))!
  staffB = (await login(email('staff-b')))!

  const payload = await payloadClient()
  programSlug = `conc-program-${stamp}`
  const doc = await payload.create({
    collection: 'programs',
    data: {
      title: 'Concurrency Program',
      slug: programSlug,
      tagline: 'Created by the concurrency suite',
      whoItsFor: richText('Anyone'),
      stage: ['idea'],
      applicationStatus: 'open',
      applicationQuestions: [{ label: 'Describe it', fieldType: 'textarea', required: true, maxLength: 500 }],
      _status: 'published',
    } as never,
    overrideAccess: true,
  })
  programId = doc.id as number
  const full = await payload.findByID({ collection: 'programs', id: programId, depth: 0, overrideAccess: true })
  questionId = (full as { applicationQuestions: { id: string }[] }).applicationQuestions[0]!.id
})
afterAll(closeDb)

describe('event registration (R-05)', () => {
  it('never sells more seats than the capacity, however many ask at once', async () => {
    const eventId = await makeEvent({ capacity: 2 })
    const sessions: Session[] = []
    for (let i = 0; i < 8; i++) {
      await createUser({ email: email(`seat${i}`), platformRole: 'student' })
      sessions.push((await login(email(`seat${i}`)))!)
    }
    const results = await Promise.all(sessions.map((s) => post(`/api/events/${eventId}/register`, s)))
    const ok = results.filter((r) => r.status === 200).length
    const rows = (await db().query('select count(*)::int c from app.event_registrations where event_id = $1', [eventId])).rows[0].c
    expect(rows).toBe(2)
    expect(ok).toBe(2)
    for (const r of results.filter((r) => r.status !== 200)) {
      expect(r.status).toBe(400)
      expect((await r.json()).error).toMatch(/full/i)
    }
  })

  it('stays idempotent for the same person, including when the event is full', async () => {
    const eventId = await makeEvent({ capacity: 1 })
    await createUser({ email: email('idem'), platformRole: 'student' })
    const s = (await login(email('idem')))!
    const results = await Promise.all([1, 2, 3].map(() => post(`/api/events/${eventId}/register`, s)))
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect((await db().query('select count(*)::int c from app.event_registrations where event_id = $1', [eventId])).rows[0].c).toBe(1)
  })

  it('refuses events that already happened and events that register elsewhere', async () => {
    await createUser({ email: email('late'), platformRole: 'student' })
    const s = (await login(email('late')))!
    const past = await makeEvent({
      startsAt: new Date(Date.now() - 3 * DAY).toISOString(),
      endsAt: new Date(Date.now() - 2 * DAY).toISOString(),
    })
    const external = await makeEvent({ registrationUrl: 'https://example.org/register' })
    const a = await post(`/api/events/${past}/register`, s)
    const b = await post(`/api/events/${external}/register`, s)
    expect(a.status).toBe(400)
    expect(b.status).toBe(400)
    expect(
      (await db().query('select count(*)::int c from app.event_registrations where event_id = any($1)', [[past, external]])).rows[0].c,
    ).toBe(0)
  })
})

describe('review transitions (R-05)', () => {
  it('lets exactly one of two simultaneous reviewers move an application, with one audit row and one notice', async () => {
    const { userId, applicationId } = await submittedApplication('review-race')
    const results = await Promise.all([
      post(`/api/admin/applications/${applicationId}/status`, staffA, { status: 'under_review' }),
      post(`/api/admin/applications/${applicationId}/status`, staffB, { status: 'under_review' }),
    ])
    const codes = results.map((r) => r.status)
    expect(codes.filter((c) => c === 200)).toHaveLength(1)
    expect(codes.filter((c) => c === 400 || c === 409)).toHaveLength(1)
    expect((await db().query('select status from app.applications where id = $1', [applicationId])).rows[0].status).toBe('under_review')
    expect(
      (await db().query("select count(*)::int c from app.audit_logs where action = 'application_status_changed' and entity_id = $1", [applicationId])).rows[0].c,
    ).toBe(1)
    expect(
      (await db().query("select count(*)::int c from app.notifications where user_id = $1 and type = 'application_status_changed'", [userId])).rows[0].c,
    ).toBe(1)
  })

  it('bounds and types the decision note', async () => {
    const { applicationId } = await submittedApplication('note')
    const long = await post(`/api/admin/applications/${applicationId}/status`, staffA, { status: 'under_review', note: 'x'.repeat(2001) })
    const bad = await post(`/api/admin/applications/${applicationId}/status`, staffA, { status: 'under_review', note: { a: 1 } })
    expect(long.status).toBe(400)
    expect(bad.status).toBe(400)
    expect((await db().query('select status from app.applications where id = $1', [applicationId])).rows[0].status).toBe('submitted')
    const fine = await post(`/api/admin/applications/${applicationId}/status`, staffA, { status: 'under_review', note: 'x'.repeat(2000) })
    expect(fine.status).toBe(200)
  })
})

describe('draft answers versus submit (R-05)', () => {
  it('nothing is written after the moment of submission', async () => {
    const mail = email('applicant')
    await createUser({ email: mail, platformRole: 'student' })
    const me = (await login(mail))!
    const started = await post('/api/applications/start', me, { programSlug })
    const applicationId = (await started.json()).applicationId as string
    expect((await post(`/api/applications/${applicationId}/answer`, me, { questionId, value: 'first' })).status).toBe(200)

    const writes = Array.from({ length: 12 }, (_, i) => post(`/api/applications/${applicationId}/answer`, me, { questionId, value: `edit ${i}` }))
    const [submit, ...answered] = await Promise.all([post(`/api/applications/${applicationId}/submit`, me, CAPTCHA), ...writes])
    expect(submit!.status).toBe(200)

    // every answer that reported success was committed before the submit froze the application
    const row = (
      await db().query(
        `select a.submitted_at, ans.updated_at from app.applications a
         join app.application_answers ans on ans.application_id = a.id where a.id = $1`,
        [applicationId],
      )
    ).rows[0]
    expect(new Date(row.updated_at).getTime()).toBeLessThanOrEqual(new Date(row.submitted_at).getTime())

    // and whatever came after is told so, rather than silently dropped
    for (const r of answered.filter((r) => r.status !== 200)) {
      expect(r.status).toBe(400)
      expect((await r.json()).error).toMatch(/already been submitted/i)
    }
    const after = await post(`/api/applications/${applicationId}/answer`, me, { questionId, value: 'too late' })
    expect(after.status).toBe(400)
  })
})

describe('a program that goes away (R-04)', () => {
  it('does not break an existing application when its program is unpublished', async () => {
    const payload = await payloadClient()
    const doc = await payload.create({
      collection: 'programs',
      data: {
        title: 'Soon unpublished',
        slug: `conc-gone-${stamp}`,
        tagline: 'Created by the concurrency suite',
        whoItsFor: richText('Anyone'),
        stage: ['idea'],
        applicationStatus: 'open',
        applicationQuestions: [{ label: 'Why?', fieldType: 'text', required: false }],
        _status: 'published',
      } as never,
      overrideAccess: true,
    })
    const goneId = doc.id as number
    const mail = email('orphan')
    const userId = await createUser({ email: mail, platformRole: 'student' })
    const appId = (
      await db().query(
        `insert into app.applications (id, user_id, program_id, status, submitted_at)
         values (gen_random_uuid()::text, $1, $2, 'submitted', now()) returning id`,
        [userId, goneId],
      )
    ).rows[0].id as string
    await payload.update({ collection: 'programs', id: goneId, data: { _status: 'draft' } as never, overrideAccess: true })

    const me = (await login(mail))!
    const list = await get('/dashboard/applications', me)
    expect(list.status).toBe(200)
    expect(await list.text()).not.toMatch(/application error|something went wrong/i)

    // staff can still open it and move it on
    const review = await get(`/admin/applications/${appId}`, staffA)
    expect(review.status).toBe(200)
    expect((await post(`/api/admin/applications/${appId}/status`, staffA, { status: 'under_review' })).status).toBe(200)
  })
})

describe('questions frozen at submit, and programs that applications depend on (R-04)', () => {
  const makeProgram = async (tag: string, label: string) => {
    const payload = await payloadClient()
    const doc = await payload.create({
      collection: 'programs',
      data: {
        title: `Snapshot ${tag}`,
        slug: `conc-snap-${tag}-${stamp}`,
        tagline: 'Created by the concurrency suite',
        whoItsFor: richText('Anyone'),
        stage: ['idea'],
        applicationStatus: 'open',
        applicationQuestions: [{ label, fieldType: 'text', required: true, maxLength: 100 }],
        _status: 'published',
      } as never,
      overrideAccess: true,
    })
    const full = await payload.findByID({ collection: 'programs', id: doc.id, depth: 0, overrideAccess: true })
    return { payload, id: doc.id as number, slug: `conc-snap-${tag}-${stamp}`, qid: (full as { applicationQuestions: { id: string }[] }).applicationQuestions[0]!.id }
  }

  it('shows reviewers the questions the applicant answered, even after the program is edited', async () => {
    const { payload, id, slug, qid } = await makeProgram('edit', 'Original wording of the question')
    const mail = email('snap-edit')
    await createUser({ email: mail, platformRole: 'student' })
    const me = (await login(mail))!
    const applicationId = (await (await post('/api/applications/start', me, { programSlug: slug })).json()).applicationId as string
    expect((await post(`/api/applications/${applicationId}/answer`, me, { questionId: qid, value: 'my answer' })).status).toBe(200)
    expect((await post(`/api/applications/${applicationId}/submit`, me, CAPTCHA)).status).toBe(200)

    const stored = (await db().query('select question_snapshot from app.applications where id = $1', [applicationId])).rows[0].question_snapshot
    expect(stored).toHaveLength(1)
    expect(stored[0].label).toBe('Original wording of the question')

    const doc = (await payload.findByID({ collection: 'programs', id, depth: 0, overrideAccess: true })) as { applicationQuestions: { id: string }[] }
    await payload.update({
      collection: 'programs',
      id,
      data: { applicationQuestions: [{ id: doc.applicationQuestions[0]!.id, label: 'Completely different question', fieldType: 'text', required: true }] } as never,
      overrideAccess: true,
    })
    const page = await (await get(`/admin/applications/${applicationId}`, staffA)).text()
    expect(page).toContain('Original wording of the question')
    expect(page).not.toContain('Completely different question')
  })

  it('refuses to delete a program that has applications, and allows it when there are none', async () => {
    const used = await makeProgram('used', 'Q')
    const unused = await makeProgram('unused', 'Q')
    await createUser({ email: email('snap-del'), platformRole: 'student' })
    const userId = (await db().query('select id from app.users where email = $1', [email('snap-del')])).rows[0].id as string
    await db().query("insert into app.applications (id, user_id, program_id, status) values (gen_random_uuid()::text, $1, $2, 'draft')", [userId, used.id])

    await expect(used.payload.delete({ collection: 'programs', id: used.id, overrideAccess: true })).rejects.toThrow(/cannot be deleted/i)
    const still = await used.payload.findByID({ collection: 'programs', id: used.id, depth: 0, overrideAccess: true })
    expect(still.id).toBe(used.id)
    await unused.payload.delete({ collection: 'programs', id: unused.id, overrideAccess: true })
    await expect(unused.payload.findByID({ collection: 'programs', id: unused.id, depth: 0, overrideAccess: true })).rejects.toThrow()
  })

  it('still shows a submitted application whose program row is gone, from its snapshot', async () => {
    const userId = await createUser({ email: email('snap-gone'), platformRole: 'student' })
    const missingProgramId = 987000000 + (stamp % 1000)
    const snapshot = [{ id: 'q1', label: 'A question from a removed program', fieldType: 'text', required: true }]
    const applicationId = (
      await db().query(
        `insert into app.applications (id, user_id, program_id, status, submitted_at, question_snapshot)
         values (gen_random_uuid()::text, $1, $2, 'submitted', now(), $3::jsonb) returning id`,
        [userId, missingProgramId, JSON.stringify(snapshot)],
      )
    ).rows[0].id as string
    await db().query(`insert into app.application_answers (id, application_id, question_id, value) values (gen_random_uuid()::text, $1, 'q1', '"kept"'::jsonb)`, [applicationId])

    const res = await get(`/admin/applications/${applicationId}`, staffA)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('A question from a removed program')
  })
})

describe('starting and submitting an application (R-06)', () => {
  it('viewing the apply page creates nothing; pressing Start does; submit leaves an audit row', async () => {
    const mail = email('explicit')
    const userId = await createUser({ email: mail, platformRole: 'student' })
    const me = (await login(mail))!
    const count = async () => (await db().query('select count(*)::int c from app.applications where user_id = $1', [userId])).rows[0].c as number

    for (let i = 0; i < 3; i++) {
      const page = await get(`/apply/${programSlug}`, me)
      expect(page.status).toBe(200)
      expect(await page.text()).toContain('Start application')
    }
    expect(await count()).toBe(0)

    const started = await post('/api/applications/start', me, { programSlug })
    expect(started.status).toBe(200)
    expect(await count()).toBe(1)
    // a second press and a reload are harmless
    expect((await post('/api/applications/start', me, { programSlug })).status).toBe(200)
    expect(await count()).toBe(1)
    const again = await (await get(`/apply/${programSlug}`, me)).text()
    expect(again).not.toContain('Start application')

    const applicationId = (await db().query('select id from app.applications where user_id = $1', [userId])).rows[0].id as string
    await post(`/api/applications/${applicationId}/answer`, me, { questionId, value: 'ready' })
    expect((await post(`/api/applications/${applicationId}/submit`, me, CAPTCHA)).status).toBe(200)
    const audit = await db().query(
      "select actor_user_id, before, after from app.audit_logs where action = 'application_submitted' and entity_id = $1",
      [applicationId],
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].actor_user_id).toBe(userId)
    expect(audit.rows[0].after).toMatchObject({ status: 'submitted', answers: 1 })
  })
})
