import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { istInstant, istParts } from '../../src/server/labs/rules'
import { BASE, closeDb, createUser, db, get, login, uniqueIp, type Session } from '../support/helpers'

/**
 * Lab oversight: what an assistant may see, an administrator standing in for an absent head
 * (with the audit trail to prove it), escalation of requests nobody has decided, and the
 * department hierarchy that the utilisation report rolls up through.
 */

const stamp = Date.now()
const mail = (n: string) => `${n}-${stamp}@oversight.test`
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensMinute: 9 * 60, closesMinute: 18 * 60 }))

let admin: Session
let head: Session
let assistant: Session
let outsider: Session
let lab: { id: string; slug: string }
let headless: { id: string; slug: string }
const ids: Record<string, string> = {}

const api = (path: string, who: Session | null, body?: unknown, method = 'POST') =>
  fetch(`${BASE()}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp(), ...(who ? { cookie: who.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const json = async (res: Response) => ({ status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> })
const day = (daysAhead: number) => istParts(new Date(Date.now() + daysAhead * 86_400_000)).date
const when = (daysAhead: number, hour: number) => ({ startsAt: istInstant(day(daysAhead), hour * 60), endsAt: istInstant(day(daysAhead), (hour + 1) * 60) })

async function member(tag: string) {
  const email = mail(tag)
  const id = await createUser({ email, platformRole: 'student' })
  await db().query('update app.users set email_verified = now(), onboarding_completed_at = now() where id = $1', [id])
  ids[tag] = id
  return { id, email }
}

async function insertBooking(input: { labId: string; userId: string; at: { startsAt: Date; endsAt: Date }; status?: string; assistantId?: string | null; createdHoursAgo?: number }) {
  const r = await db().query(
    `insert into app.lab_bookings (id, lab_id, user_id, starts_at, ends_at, purpose, headcount, status, assistant_user_id, created_at)
     values (gen_random_uuid()::text, $1, $2, $3, $4, 'Oversight test', 1, $5, $6, now() - ($7 || ' hours')::interval) returning id`,
    [input.labId, input.userId, input.at.startsAt, input.at.endsAt, input.status ?? 'requested', input.assistantId ?? null, String(input.createdHoursAgo ?? 0)],
  )
  return r.rows[0].id as string
}

beforeAll(async () => {
  await createUser({ email: mail('admin'), platformRole: 'other', staffRole: 'lab_admin' })
  admin = (await login(mail('admin')))!
  for (const [tag, set] of [['head', (s: Session) => (head = s)], ['assistant', (s: Session) => (assistant = s)], ['outsider', (s: Session) => (outsider = s)]] as const) {
    await member(tag)
    set((await login(mail(tag)))!)
  }
  const create = async (name: string) => {
    const r = await json(await api('/api/admin/labs', admin, { name, department: 'Engineering', capacity: 4 }))
    expect(r.status).toBe(201)
    return { id: r.body.id as string, slug: r.body.slug as string }
  }
  lab = await create(`Oversight Lab ${stamp}`)
  headless = await create(`Headless Lab ${stamp}`)
  for (const [target, email, role] of [[lab, mail('head'), 'head'], [lab, mail('assistant'), 'assistant']] as const) {
    expect((await json(await api(`/api/labs/${target.slug}/manage`, admin, { action: 'staff-add', staff: { email, role } }))).status).toBe(200)
  }
  for (const target of [lab, headless]) expect((await json(await api(`/api/labs/${target.slug}/manage`, admin, { action: 'hours', windows: ALL_WEEK }))).status).toBe(200)
})
afterAll(closeDb)

describe('what an assistant sees', () => {
  it('only the bookings assigned to them: the other bookers are not on their page', async () => {
    const mine = await member('booker-mine')
    const theirs = await member('booker-other')
    await insertBooking({ labId: lab.id, userId: mine.id, at: when(3, 10), status: 'approved', assistantId: ids.assistant })
    await insertBooking({ labId: lab.id, userId: theirs.id, at: when(3, 12), status: 'approved', assistantId: null })

    const assistantHtml = await (await get(`/dashboard/lab-staff/${lab.slug}`, assistant)).text()
    expect(assistantHtml).toContain(mine.email)
    expect(assistantHtml).not.toContain(theirs.email)

    const headHtml = await (await get(`/dashboard/lab-staff/${lab.slug}`, head)).text()
    expect(headHtml).toContain(mine.email)
    expect(headHtml).toContain(theirs.email)
  })

  it('cannot see the report, the decision history, or decide', async () => {
    const m = await member('booker-decide')
    const b = await insertBooking({ labId: lab.id, userId: m.id, at: when(4, 10) })
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, assistant, { action: 'approve' }))).status).toBe(403)
    const html = await (await get(`/dashboard/lab-staff/${lab.slug}`, assistant)).text()
    expect(html).not.toContain('Decision history')
    expect((await api(`/api/labs/report.csv?from=${day(-1)}&to=${day(10)}`, assistant, undefined, 'GET')).status).toBe(403)
  })
})

describe('an administrator standing in for the head', () => {
  it('must give a reason while the lab has a head, and the record says it was an override', async () => {
    const m = await member('booker-override')
    const b = await insertBooking({ labId: lab.id, userId: m.id, at: when(5, 10) })
    const silent = await json(await api(`/api/labs/bookings/${b}/decide`, admin, { action: 'approve' }))
    expect([silent.status, silent.body.code]).toEqual([400, 'invalid'])
    expect((await db().query('select status from app.lab_bookings where id = $1', [b])).rows[0].status).toBe('requested')

    expect((await json(await api(`/api/labs/bookings/${b}/decide`, admin, { action: 'approve', note: 'Head is away until Monday' }))).status).toBe(200)
    const audit = (await db().query("select after from app.audit_logs where entity_id = $1 and action = 'lab_booking_approved'", [b])).rows[0].after
    expect(audit).toMatchObject({ status: 'approved', override: true, headPresent: true, reason: 'Head is away until Monday' })

    const history = await (await get(`/dashboard/lab-staff/${lab.slug}`, head)).text()
    expect(history).toContain('Decision history')
    expect(history).toContain('Administrator override')
    expect(history).toContain('Head is away until Monday')
  })

  it('the head’s own decision is not an override', async () => {
    const m = await member('booker-headdecides')
    const b = await insertBooking({ labId: lab.id, userId: m.id, at: when(5, 12) })
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, head, { action: 'approve' }))).status).toBe(200)
    const audit = (await db().query("select after from app.audit_logs where entity_id = $1 and action = 'lab_booking_approved'", [b])).rows[0].after
    expect(audit.override).toBeUndefined()
  })

  it('needs no reason when the lab has no head at all', async () => {
    const m = await member('booker-headless')
    const b = await insertBooking({ labId: headless.id, userId: m.id, at: when(5, 14) })
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, admin, { action: 'approve' }))).status).toBe(200)
    const audit = (await db().query("select after from app.audit_logs where entity_id = $1 and action = 'lab_booking_approved'", [b])).rows[0].after
    expect(audit).toMatchObject({ override: true, headPresent: false })
  })
})

describe('escalation', () => {
  it('lists a request that has waited past the lab’s own threshold, and one in a lab with no head, for administrators only', async () => {
    const slow = await member('booker-slow')
    const fresh = await member('booker-fresh')
    const orphan = await member('booker-orphan')
    expect((await json(await api(`/api/labs/${lab.slug}/manage`, head, { action: 'update', settings: { escalateAfterHours: 24 } }))).status).toBe(200)
    await insertBooking({ labId: lab.id, userId: slow.id, at: when(6, 10), createdHoursAgo: 30 })
    await insertBooking({ labId: lab.id, userId: fresh.id, at: when(6, 12), createdHoursAgo: 2 })
    await insertBooking({ labId: headless.id, userId: orphan.id, at: when(6, 10) })

    const page = await (await get('/admin/labs', admin)).text()
    expect(page).toContain('Needs an administrator')
    expect(page).toContain(slow.email)
    expect(page).toContain(orphan.email)
    expect(page).not.toContain(fresh.email)
    expect(page).toContain('This lab has no head.')
  })

  it('a head cannot set an impossible threshold', async () => {
    expect((await json(await api(`/api/labs/${lab.slug}/manage`, head, { action: 'update', settings: { escalateAfterHours: 0 } }))).status).toBe(400)
  })
})

describe('departments are data', () => {
  let college: string
  let engineering: string
  let electrical: string

  const call = (who: Session | null, body: unknown) => api('/api/admin/lab-departments', who, body)

  it('only an administrator can change the hierarchy', async () => {
    expect((await call(null, { action: 'create', department: { name: 'Nope' } })).status).toBe(401)
    for (const who of [head, assistant, outsider]) expect((await call(who, { action: 'create', department: { name: 'Nope' } })).status).toBe(403)
  })

  it('builds a tree, refuses a cycle, and places a lab in it', async () => {
    const a = await json(await call(admin, { action: 'create', department: { name: `College ${stamp}` } }))
    expect(a.status).toBe(201)
    college = a.body.id as string
    const b = await json(await call(admin, { action: 'create', department: { name: `Engineering ${stamp}`, parentId: college } }))
    engineering = b.body.id as string
    const c = await json(await call(admin, { action: 'create', department: { name: `Electrical ${stamp}`, parentId: engineering } }))
    electrical = c.body.id as string

    const cycle = await json(await call(admin, { action: 'update', id: college, department: { parentId: electrical } }))
    expect([cycle.status, cycle.body.code]).toEqual([409, 'state'])
    expect((await json(await call(admin, { action: 'create', department: { name: 'Orphan child', parentId: 'no-such-id' } }))).status).toBe(404)

    expect((await json(await api(`/api/labs/${lab.slug}/manage`, head, { action: 'update', settings: { departmentId: electrical } }))).status).toBe(403)
    expect((await json(await api(`/api/labs/${lab.slug}/manage`, admin, { action: 'update', settings: { departmentId: electrical } }))).status).toBe(200)
    const row = (await db().query('select department_id, department from app.labs where id = $1', [lab.id])).rows[0]
    expect(row).toMatchObject({ department_id: electrical, department: `Electrical ${stamp}` })
  })

  it('the report adds a lab to its department and to every department above it, in the page and in the download', async () => {
    const m = await member('booker-report')
    await insertBooking({ labId: lab.id, userId: m.id, at: when(2, 10), status: 'approved' })
    const csv = await (await api(`/api/labs/report.csv?from=${day(-1)}&to=${day(10)}`, admin, undefined, 'GET')).text()
    const all = csv.split('\r\n')
    const lines = all.slice(all.indexOf('') + 1) // the department block follows the per-lab block and a blank line
    const requests = (name: string) => {
      const line = lines.find((l) => l.startsWith(name))
      expect(line, name).toBeTruthy()
      return Number(line!.split(',')[3]) // name, level, labs, requests
    }
    const electricalRequests = requests(`Electrical ${stamp}`)
    expect(electricalRequests).toBeGreaterThanOrEqual(1)
    expect(requests(`Engineering ${stamp}`)).toBe(electricalRequests)
    expect(requests(`College ${stamp}`)).toBe(electricalRequests)

    const page = await (await get(`/admin/labs/report?from=${day(-1)}&to=${day(10)}`, admin)).text()
    expect(page).toContain(`College ${stamp}`)
    expect(page).toContain('every department below it')
  })

  it('removing a department keeps its labs and bookings; children move to the top', async () => {
    expect((await json(await call(admin, { action: 'delete', id: engineering }))).status).toBe(200)
    expect((await db().query('select parent_id from app.lab_departments where id = $1', [electrical])).rows[0].parent_id).toBeNull()
    expect((await db().query('select count(*)::int c from app.labs where id = $1', [lab.id])).rows[0].c).toBe(1)
  })
})
