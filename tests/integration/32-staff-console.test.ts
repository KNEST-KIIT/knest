import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, createUser, db, get, login, uniqueIp, type Session } from '../support/helpers'

/**
 * The staff console: who can open each screen, and that each screen does its job against real
 * data (queue search and paging, enquiries inbox, audit viewer, members).
 */

const stamp = Date.now()
const mail = (n: string) => `${n}-${stamp}@console.test`
const ROLES = ['reviewer', 'content_admin', 'program_manager', 'startup_manager', 'mentor_manager', 'lab_admin', 'super_admin'] as const

const sessions: Record<string, Session> = {}
let student: Session
let programA: number
let programB: number

const post = (path: string, who: Session | null, body?: unknown) =>
  fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp(), ...(who ? { cookie: who.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

async function seedApplication(tag: string, programId: number, status: string, name = tag) {
  const userId = await createUser({ email: mail(`app-${tag}`), platformRole: 'student' })
  await db().query('update app.users set name = $1 where id = $2', [name, userId])
  const submitted = status === 'draft' ? 'null' : "now() - (random() * interval '30 days')"
  const res = await db().query(
    `insert into app.applications (id, user_id, program_id, status, submitted_at) values (gen_random_uuid()::text, $1, $2, $3::app.application_status, ${submitted}) returning id`,
    [userId, programId, status],
  )
  return { userId, applicationId: res.rows[0].id as string }
}

beforeAll(async () => {
  programA = 910_000_000 + (stamp % 1000)
  programB = programA + 1
  for (const role of ROLES) {
    await createUser({ email: mail(role), platformRole: 'other', staffRole: role })
    sessions[role] = (await login(mail(role)))!
  }
  await createUser({ email: mail('student'), platformRole: 'student' })
  student = (await login(mail('student')))!
})
afterAll(closeDb)

describe('who can open which screen', () => {
  // overview: any staff. The rest follow ADMIN_AREAS (super_admin passes everything).
  const SCREENS: [string, readonly string[]][] = [
    ['/admin/overview', ROLES],
    ['/admin/applications', ['program_manager', 'reviewer', 'super_admin']],
    ['/admin/enquiries', ['content_admin', 'super_admin']],
    ['/admin/members', ['super_admin']],
    ['/admin/audit', ['super_admin']],
    ['/admin/analytics', ['super_admin']],
  ]

  it.each(SCREENS)('%s', async (path, allowed) => {
    for (const role of ROLES) {
      const res = await get(path, sessions[role])
      expect(res.status, `${role} on ${path}`).toBe(allowed.includes(role) ? 200 : 404)
    }
    // a member with no staff role, and a visitor, never learn the screen exists
    expect((await get(path, student)).status).toBe(404)
    expect((await get(path)).status).toBeGreaterThanOrEqual(300)
    expect([307, 308, 404]).toContain((await get(path)).status)
  })

  it('the navigation shows only the screens the role may open', async () => {
    const reviewerHtml = await (await get('/admin/overview', sessions.reviewer!)).text()
    expect(reviewerHtml).toContain('href="/admin/applications"')
    for (const hidden of ['/admin/members', '/admin/audit', '/admin/enquiries', '/admin/analytics']) expect(reviewerHtml).not.toContain(`href="${hidden}"`)
    const superHtml = await (await get('/admin/overview', sessions.super_admin!)).text()
    for (const shown of ['/admin/applications', '/admin/members', '/admin/audit', '/admin/enquiries']) expect(superHtml).toContain(`href="${shown}"`)
  })
})

describe('the applications queue', () => {
  it('lists submitted applications only: a draft is the applicant’s own work', async () => {
    await seedApplication('draftperson', programA, 'draft', `Draftperson${stamp}`)
    await seedApplication('submitted-one', programA, 'submitted', `Sunitha Rao ${stamp}`)
    const html = await (await get(`/admin/applications?q=${stamp}`, sessions.program_manager!)).text()
    expect(html).toContain(`Sunitha Rao ${stamp}`)
    expect(html).not.toContain(`Draftperson${stamp}`)
  })

  it('searches by name and by email, and treats % and _ literally', async () => {
    await seedApplication('searchable', programA, 'under_review', `Unique Findable Name ${stamp}`)
    const byName = await (await get(`/admin/applications?q=${encodeURIComponent('Unique Findable Name')}`, sessions.reviewer!)).text()
    expect(byName).toContain(`Unique Findable Name ${stamp}`)
    const byEmail = await (await get(`/admin/applications?q=${encodeURIComponent(mail('app-searchable'))}`, sessions.reviewer!)).text()
    expect(byEmail).toContain(`Unique Findable Name ${stamp}`)
    const wildcard = await (await get(`/admin/applications?q=${encodeURIComponent('%')}`, sessions.reviewer!)).text()
    expect(wildcard).not.toContain(`Unique Findable Name ${stamp}`)
  })

  it('filters by status and by program', async () => {
    await seedApplication('accepted-b', programB, 'accepted', `Accepted Person ${stamp}`)
    const accepted = await (await get(`/admin/applications?status=accepted&q=${stamp}`, sessions.reviewer!)).text()
    expect(accepted).toContain(`Accepted Person ${stamp}`)
    expect(accepted).not.toContain(`Unique Findable Name ${stamp}`)
    const onlyA = await (await get(`/admin/applications?program=${programA}&q=${stamp}`, sessions.reviewer!)).text()
    expect(onlyA).not.toContain(`Accepted Person ${stamp}`)
    expect(onlyA).toContain(`Unique Findable Name ${stamp}`)
  })

  it('pages the list, 25 at a time, without losing or repeating anyone', async () => {
    const tag = `pg${stamp}`
    for (let i = 0; i < 30; i++) await seedApplication(`${tag}-${i}`, programA, 'submitted', `Paged Person ${tag} ${String(i).padStart(2, '0')}`)
    const names = (html: string) => [...html.matchAll(new RegExp(`Paged Person ${tag} (\\d\\d)`, 'g'))].map((m) => m[1]!)
    const pageOne = await (await get(`/admin/applications?q=${tag}`, sessions.reviewer!)).text()
    const pageTwo = await (await get(`/admin/applications?q=${tag}&page=2`, sessions.reviewer!)).text()
    const one = new Set(names(pageOne))
    const two = new Set(names(pageTwo))
    expect(one.size).toBe(25)
    expect(two.size).toBe(5)
    expect([...one].filter((n) => two.has(n))).toEqual([])
    expect(one.size + two.size).toBe(30)
    // React puts comment nodes between adjacent text values; compare the visible text.
    expect(pageOne.replace(/<!-- -->/g, '')).toContain('Showing 1–25 of 30')
    expect(pageOne).toContain('rel="next"')
  })
})

describe('the enquiries inbox', () => {
  it('shows a stored message to a content admin, who can mark it handled once, with an audit row', async () => {
    const email = `inbox-${stamp}@example.test`
    const r = await db().query("insert into app.enquiries (id, name, email, topic, message) values (gen_random_uuid()::text, 'Inbox Person', $1, 'press', 'A question for the press office.') returning id", [email])
    const id = r.rows[0].id as string
    const page = await (await get('/admin/enquiries?status=new', sessions.content_admin!)).text()
    expect(page).toContain('Inbox Person')
    expect(page).toContain('A question for the press office.')

    expect((await post(`/api/admin/enquiries/${id}/handled`, sessions.content_admin!)).status).toBe(200)
    expect((await post(`/api/admin/enquiries/${id}/handled`, sessions.content_admin!)).status).toBe(200) // idempotent
    const row = (await db().query('select status, handled_by from app.enquiries where id = $1', [id])).rows[0]
    expect(row.status).toBe('handled')
    expect(row.handled_by).toBeTruthy()
    expect((await db().query("select count(*)::int c from app.audit_logs where action = 'enquiry_handled' and entity_id = $1", [id])).rows[0].c).toBe(1)
    expect(await (await get('/admin/enquiries?status=handled', sessions.content_admin!)).text()).toContain('Inbox Person')
  })

  it('refuses everyone who may not read it, and an unknown id', async () => {
    const r = await db().query("insert into app.enquiries (id, name, email, message) values (gen_random_uuid()::text, 'Closed Door', 'cd@example.test', 'Private words here.') returning id")
    const id = r.rows[0].id as string
    for (const who of [null, student, sessions.reviewer!, sessions.program_manager!]) {
      const res = await post(`/api/admin/enquiries/${id}/handled`, who)
      expect([401, 403, 404]).toContain(res.status)
    }
    expect((await db().query('select status from app.enquiries where id = $1', [id])).rows[0].status).toBe('new')
    expect((await post('/api/admin/enquiries/does-not-exist/handled', sessions.content_admin!)).status).toBe(404)
  })
})

describe('the audit trail viewer', () => {
  it('lists what staff did, who did it and the change, and can filter by action', async () => {
    const targetMail = mail('audit-target')
    const targetId = await createUser({ email: targetMail, platformRole: 'student' })
    expect((await post(`/api/admin/members/${targetId}/active`, sessions.super_admin!, { isActive: false })).status).toBe(200)

    const all = await (await get('/admin/audit', sessions.super_admin!)).text()
    expect(all).toContain('account deactivated')
    expect(all).toContain(mail('super_admin'))
    const filtered = await (await get('/admin/audit?action=account_deactivated', sessions.super_admin!)).text()
    expect(filtered).toContain('account deactivated')
    // entries are rendered as <strong>action</strong>; the filter dropdown lists every action, so look at entries only
    expect(filtered).not.toContain('<strong>enquiry handled</strong>')
    expect(filtered).toContain('<strong>account deactivated</strong>')
    expect(filtered).toMatch(/isActive: true/)
  })

  it('ignores a filter value that is not on record', async () => {
    const res = await get(`/admin/audit?action=${encodeURIComponent("x' or 1=1 --")}`, sessions.super_admin!)
    expect(res.status).toBe(200)
  })
})

describe('the members screen', () => {
  it('finds accounts by email, filters deactivated ones, and does not offer a super admin controls over themselves', async () => {
    const t = await createUser({ email: mail('findme'), platformRole: 'student' })
    await db().query('update app.users set name = $1 where id = $2', [`Findable Member ${stamp}`, t])
    const found = await (await get(`/admin/members?q=${encodeURIComponent(mail('findme'))}`, sessions.super_admin!)).text()
    expect(found).toContain(`Findable Member ${stamp}`)

    await post(`/api/admin/members/${t}/active`, sessions.super_admin!, { isActive: false })
    const inactive = await (await get(`/admin/members?inactive=1&q=${stamp}`, sessions.super_admin!)).text()
    expect(inactive).toContain(`Findable Member ${stamp}`)
    expect(inactive).toContain('Deactivated')

    const self = await (await get(`/admin/members?q=${encodeURIComponent(mail('super_admin'))}`, sessions.super_admin!)).text()
    expect(self).toContain('This is your own account.')
  })
})

describe('the overview', () => {
  it('counts what is really in the database, and shows each role only its own figures', async () => {
    const awaiting = (await db().query("select count(*)::int c from app.applications where status = 'submitted'")).rows[0].c as number
    const superHtml = await (await get('/admin/overview', sessions.super_admin!)).text()
    expect(superHtml).toMatch(new RegExp(`Applications awaiting a first look</span><span[^>]*>${awaiting}<`))
    expect(superHtml).toContain('Latest staff actions')

    const contentHtml = await (await get('/admin/overview', sessions.content_admin!)).text()
    expect(contentHtml).toContain('New enquiries')
    expect(contentHtml).not.toContain('Applications awaiting')
    expect(contentHtml).not.toContain('Latest staff actions')
    expect(contentHtml).not.toContain('Active accounts')
  })
})
