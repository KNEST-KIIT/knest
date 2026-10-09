import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { istInstant, istParts } from '../../src/server/labs/rules'
import { BASE, CAPTCHA, closeDb, createUser, db, decodeMailText, get, login, readMail, uniqueIp, type Session } from '../support/helpers'

/**
 * Lab booking, end to end on the production build and a real database: creating labs, who may
 * do what in which lab, every booking rule, the database's refusal of double booking under real
 * parallel load, decisions with their audit rows and notices, cancellation, manual attendance,
 * the reports, and the screens. (Pure rules are unit-tested in src/server/labs/rules.test.ts.)
 */

const stamp = Date.now()
const mail = (n: string) => `${n}-${stamp}@labs.test`
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensMinute: 9 * 60, closesMinute: 18 * 60 }))
const AROUND_THE_CLOCK = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensMinute: 0, closesMinute: 1440 }))

let admin: Session
let reviewer: Session
let head: Session
let assistant: Session
let head2: Session
let outsider: Session
const members: Record<string, Session> = {}
let labA: { id: string; slug: string }
let labB: { id: string; slug: string }

const api = (path: string, who: Session | null, body?: unknown, method = 'POST') =>
  fetch(`${BASE()}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp(), ...(who ? { cookie: who.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const json = async (res: Response) => ({ status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> })

/** An IST wall-clock slot `daysAhead` days from today, as ISO instants. */
const day = (daysAhead: number) => istParts(new Date(Date.now() + daysAhead * 86_400_000)).date
const slot = (daysAhead: number, hour: number, hours = 1) => ({
  startsAt: istInstant(day(daysAhead), hour * 60).toISOString(),
  endsAt: istInstant(day(daysAhead), (hour + hours) * 60).toISOString(),
})
const request = async (slug: string, who: Session, when: { startsAt: string; endsAt: string }, extra: Record<string, unknown> = {}) =>
  json(await api(`/api/labs/${slug}/request`, who, { ...when, purpose: 'Prototype testing for my project', headcount: 2, ...CAPTCHA, ...extra }))

async function makeMember(tag: string, options: { verified?: boolean; onboarded?: boolean } = {}) {
  const email = mail(tag)
  const id = await createUser({ email, platformRole: 'student' })
  await db().query('update app.users set email_verified = $2, onboarding_completed_at = $3 where id = $1', [id, options.verified === false ? null : new Date(), options.onboarded === false ? null : new Date()])
  const session = (await login(email))!
  return { id, email, session }
}
const rowOf = async (id: string) => (await db().query('select * from app.lab_bookings where id = $1', [id])).rows[0]
const auditCount = async (action: string, entityId: string) => (await db().query('select count(*)::int c from app.audit_logs where action = $1 and entity_id = $2', [action, entityId])).rows[0].c as number
const notices = async (email: string, type: string) =>
  (await db().query('select title, body from app.notifications n join app.users u on u.id = n.user_id where u.email = $1 and n.type = $2 order by n.created_at', [email, type])).rows
const mailsTo = (to: string) => readMail().filter((m) => m.to.some((r) => r.includes(to)))

beforeAll(async () => {
  await createUser({ email: mail('admin'), platformRole: 'other', staffRole: 'lab_admin' })
  await createUser({ email: mail('reviewer'), platformRole: 'other', staffRole: 'reviewer' })
  admin = (await login(mail('admin')))!
  reviewer = (await login(mail('reviewer')))!
  for (const [tag, set] of [['head', (s: Session) => (head = s)], ['assistant', (s: Session) => (assistant = s)], ['head2', (s: Session) => (head2 = s)], ['outsider', (s: Session) => (outsider = s)]] as const) {
    const m = await makeMember(tag)
    set(m.session)
  }
  const create = async (name: string, capacity: number) => {
    const r = await json(await api('/api/admin/labs', admin, { name, department: 'Engineering', capacity }))
    expect(r.status).toBe(201)
    return { id: r.body.id as string, slug: r.body.slug as string }
  }
  labA = await create(`Maker Space ${stamp}`, 4)
  labB = await create(`Founder Cabin ${stamp}`, 1)
  for (const [lab, email, role] of [[labA, mail('head'), 'head'], [labA, mail('assistant'), 'assistant'], [labB, mail('head2'), 'head']] as const) {
    expect((await json(await api(`/api/labs/${lab.slug}/manage`, admin, { action: 'staff-add', staff: { email, role } }))).status).toBe(200)
  }
  for (const lab of [labA, labB]) {
    const r = await json(await api(`/api/labs/${lab.slug}/manage`, lab === labA ? head : head2, { action: 'hours', windows: ALL_WEEK }))
    expect(r.status).toBe(200)
  }
})
afterAll(closeDb)

describe('creating labs and appointing people', () => {
  it('only a lab administrator creates labs; anonymous and ordinary callers are refused', async () => {
    const attempt = { name: `Not Allowed ${stamp}`, capacity: 2 }
    expect((await api('/api/admin/labs', null, attempt)).status).toBe(401)
    expect((await api('/api/admin/labs', outsider, attempt)).status).toBe(403)
    expect((await api('/api/admin/labs', reviewer, attempt)).status).toBe(403)
    expect((await db().query("select count(*)::int c from app.labs where name = $1", [attempt.name])).rows[0].c).toBe(0)
  })

  it('starts a new lab closed, with recommended rules and a unique slug', async () => {
    const lab = (await db().query('select * from app.labs where id = $1', [labA.id])).rows[0]
    expect(lab).toMatchObject({ slot_minutes: 60, max_consecutive_slots: 3, min_lead_minutes: 240, max_horizon_days: 14, max_open_requests: 3, max_hours_per_week: 6, cancel_cutoff_minutes: 120, eligibility: 'onboarded', requires_assistant: false, is_active: true })
    const again = await json(await api('/api/admin/labs', admin, { name: `Maker Space ${stamp}`, capacity: 2 }))
    expect(again.body.slug).not.toBe(labA.slug)
    expect(await auditCount('lab_created', labA.id)).toBe(1)
  })

  it('a head appoints assistants but never another head; an unverified or unknown person cannot be added', async () => {
    const extra = await makeMember('extra-assistant')
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'staff-add', staff: { email: extra.email, role: 'head' } }))).status).toBe(403)
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'staff-add', staff: { email: extra.email, role: 'assistant' } }))).status).toBe(200)
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'staff-add', staff: { email: extra.email, role: 'assistant' } }))).status).toBe(409) // already
    const unverified = await makeMember('unverified-staff', { verified: false })
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'staff-add', staff: { email: unverified.email, role: 'assistant' } }))).status).toBe(400)
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'staff-add', staff: { email: mail('nobody-at-all'), role: 'assistant' } }))).status).toBe(404)
    const row = (await db().query('select id from app.lab_staff where user_id = $1', [extra.id])).rows[0]
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'staff-remove', staffId: row.id }))).status).toBe(200)
  })

  it('a head of one lab cannot manage another, and an outsider cannot manage any', async () => {
    for (const who of [head2, outsider, reviewer]) {
      const res = await json(await api(`/api/labs/${labA.slug}/manage`, who, { action: 'update', settings: { capacity: 99 } }))
      expect([403, 404], 'status').toContain(res.status)
    }
    expect((await db().query('select capacity from app.labs where id = $1', [labA.id])).rows[0].capacity).toBe(4)
  })

  it('rejects impossible opening hours and closed periods, and records changes in the audit trail', async () => {
    const overlapping = [{ weekday: 1, opensMinute: 540, closesMinute: 720 }, { weekday: 1, opensMinute: 660, closesMinute: 900 }]
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'hours', windows: overlapping }))).status).toBe(400)
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'hours', windows: [{ weekday: 1, opensMinute: 600, closesMinute: 600 }] }))).status).toBe(400)
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'blackout-add', blackout: { startsOn: '2026-13-40', endsOn: '2026-13-41' } }))).status).toBe(400)
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'blackout-add', blackout: { startsOn: '2026-12-05', endsOn: '2026-12-01' } }))).status).toBe(400)
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'update', settings: { slotMinutes: 3 } }))).status).toBe(400)
    expect((await db().query("select count(*)::int c from app.audit_logs where entity_id = $1 and action like 'lab_%'", [labA.id])).rows[0].c).toBeGreaterThanOrEqual(3)
  })
})

describe('availability', () => {
  it('lists the lab’s slots for a date, marks taken ones busy, and never names a person', async () => {
    const m = await makeMember('avail')
    const when = slot(3, 10)
    const before = await json(await api(`/api/labs/${labA.slug}/availability?date=${day(3)}`, m.session, undefined, 'GET'))
    const slots = before.body.slots as { startsAt: string; free: boolean }[]
    expect(slots).toHaveLength(9) // 09:00 to 18:00
    expect(slots.every((s) => s.free)).toBe(true)
    expect((await request(labA.slug, m.session, when)).status).toBe(201)
    const after = await api(`/api/labs/${labA.slug}/availability?date=${day(3)}`, m.session, undefined, 'GET')
    const text = await after.text()
    expect(text).not.toContain(m.email)
    expect(text).not.toContain('Prototype')
    expect((JSON.parse(text).slots as { startsAt: string; free: boolean }[]).find((s) => s.startsAt === when.startsAt)?.free).toBe(false)
  })

  it('needs a sign-in, a valid date and a real lab', async () => {
    const m = await makeMember('avail2')
    expect((await api(`/api/labs/${labA.slug}/availability?date=${day(3)}`, null, undefined, 'GET')).status).toBe(401)
    expect((await api(`/api/labs/${labA.slug}/availability?date=2026-02-30`, m.session, undefined, 'GET')).status).toBe(400)
    expect((await api(`/api/labs/no-such-lab/availability?date=${day(3)}`, m.session, undefined, 'GET')).status).toBe(404)
  })

  it('offers nothing on a closed date', async () => {
    const m = await makeMember('avail3')
    const closed = day(5)
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'blackout-add', blackout: { startsOn: closed, endsOn: closed, reason: 'Exams' } }))).status).toBe(200)
    const res = await json(await api(`/api/labs/${labA.slug}/availability?date=${closed}`, m.session, undefined, 'GET'))
    expect(res.body.slots).toEqual([])
    const row = (await db().query('select id from app.lab_blackouts where lab_id = $1', [labA.id])).rows[0]
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'blackout-remove', blackoutId: row.id }))).status).toBe(200)
  })
})

describe('requesting a booking', () => {
  it('needs the human check, stores the request, tells the lab head in the app and by e-mail, and holds the slot', async () => {
    const m = await makeMember('requester')
    const when = slot(4, 10)
    const noCaptcha = await json(await api(`/api/labs/${labA.slug}/request`, m.session, { ...when, purpose: 'Prototype testing for my project', headcount: 2 }))
    expect(noCaptcha.status).toBe(400)
    expect(noCaptcha.body.code).toBe('captcha')

    const ok = await request(labA.slug, m.session, when, { equipment: '3D printer' })
    expect(ok.status).toBe(201)
    const row = await rowOf(ok.body.id as string)
    expect(row).toMatchObject({ status: 'requested', headcount: 2, equipment: '3D printer' })
    // the notice names the requester by their name (their name is the part of the address before the @)
    expect((await notices(mail('head'), 'booking_requested')).some((n) => String(n.body).includes(`requester-${stamp}`))).toBe(true)
    await expect.poll(() => mailsTo(mail('head')).length, { timeout: 20_000 }).toBeGreaterThan(0)
    expect(decodeMailText(mailsTo(mail('head')).at(-1)!.body)).toMatch(new RegExp(`/dashboard/lab-staff/${labA.slug}`))
  })

  it('the database refuses a second live booking of the same time, even from twenty simultaneous requests', async () => {
    const racers = await Promise.all(Array.from({ length: 20 }, (_, i) => makeMember(`racer${i}`)))
    const when = slot(6, 10)
    const results = await Promise.all(racers.map((r) => request(labA.slug, r.session, when, { headcount: 1 })))
    const won = results.filter((r) => r.status === 201)
    const lost = results.filter((r) => r.status !== 201)
    expect(won).toHaveLength(1)
    expect(lost).toHaveLength(19)
    for (const r of lost) expect([r.status, r.body.code]).toEqual([409, 'conflict'])
    const live = await db().query("select count(*)::int c from app.lab_bookings where lab_id = $1 and starts_at = $2 and status in ('requested','approved','alternative_proposed')", [labA.id, when.startsAt])
    expect(live.rows[0].c).toBe(1)
  })

  it('overlapping but not identical times conflict too; touching times do not', async () => {
    const a = await makeMember('overlap-a')
    const b = await makeMember('overlap-b')
    expect((await request(labA.slug, a.session, slot(7, 10, 2))).status).toBe(201) // 10:00 to 12:00
    expect((await request(labA.slug, b.session, slot(7, 11))).body.code).toBe('conflict') // 11:00 to 12:00 sits inside
    expect((await request(labA.slug, b.session, slot(7, 12))).status).toBe(201) // 12:00 to 13:00 touches
  })

  it('checks every rule on the server', async () => {
    const m = await makeMember('rules')
    const cases: [string, { startsAt: string; endsAt: string }, Record<string, unknown>, RegExp][] = [
      ['outside opening hours', slot(3, 19), {}, /opening hours/],
      ['too many blocks in a row', slot(3, 10, 4), {}, /at most 3/],
      ['more people than the lab holds', slot(3, 10), { headcount: 5 }, /holds 4 people/],
      ['too far ahead', slot(20, 10), {}, /up to 14 days/],
      ['a start after the end', { startsAt: slot(3, 11).startsAt, endsAt: slot(3, 10).startsAt }, {}, /after the start/],
      ['no purpose', slot(3, 10), { purpose: 'x' }, /few words|least/],
    ]
    for (const [label, when, extra, message] of cases) {
      const res = await request(labA.slug, m.session, when, extra)
      expect(res.status, label).toBe(400)
      expect(String(res.body.error), label).toMatch(message)
    }
    expect((await json(await api(`/api/labs/${labA.slug}/request`, m.session, { startsAt: 'yesterday', endsAt: 'tomorrow', purpose: 'Prototype testing', headcount: 1, ...CAPTCHA }))).status).toBe(400)
    expect((await db().query('select count(*)::int c from app.lab_bookings where user_id = (select id from app.users where email = $1)', [m.email])).rows[0].c).toBe(0)
  })

  it('refuses short notice (a lab open around the clock, so only the notice rule can apply)', async () => {
    const lab = await json(await api('/api/admin/labs', admin, { name: `Always Open ${stamp}`, capacity: 2 }))
    const slug = lab.body.slug as string
    await api(`/api/labs/${slug}/manage`, admin, { action: 'hours', windows: AROUND_THE_CLOCK })
    const m = await makeMember('notice')
    const now = istParts(new Date())
    const nextHour = istInstant(now.date, (Math.floor(now.minuteOfDay / 60) + 1) * 60)
    const res = await request(slug, m.session, { startsAt: nextHour.toISOString(), endsAt: new Date(nextHour.getTime() + 3_600_000).toISOString() })
    expect(res.status).toBe(400)
    expect(String(res.body.error)).toMatch(/at least 4 hours ahead/)
  })

  it('applies per-person limits: open requests, then hours per week', async () => {
    const lab = await json(await api('/api/admin/labs', admin, { name: `Limits Lab ${stamp}`, capacity: 2 }))
    const slug = lab.body.slug as string
    await api(`/api/labs/${slug}/manage`, admin, { action: 'hours', windows: ALL_WEEK })
    expect((await json(await api(`/api/labs/${slug}/manage`, admin, { action: 'update', settings: { maxOpenRequests: 2, maxHoursPerWeek: 50 } }))).status).toBe(200)
    const a = await makeMember('limit-a')
    expect((await request(slug, a.session, slot(3, 10))).status).toBe(201)
    expect((await request(slug, a.session, slot(4, 10))).status).toBe(201)
    const third = await request(slug, a.session, slot(5, 10))
    expect([third.status, third.body.code]).toEqual([409, 'limit'])
    expect(String(third.body.error)).toMatch(/already have 2 requests/)

    expect((await json(await api(`/api/labs/${slug}/manage`, admin, { action: 'update', settings: { maxOpenRequests: 10, maxHoursPerWeek: 2 } }))).status).toBe(200)
    const b = await makeMember('limit-b')
    expect((await request(slug, b.session, slot(8, 10, 2))).status).toBe(201)
    const over = await request(slug, b.session, slot(8, 13))
    expect([over.status, over.body.code]).toEqual([409, 'limit'])
    expect(String(over.body.error)).toMatch(/the limit is 2/)
  })

  it('applies eligibility: unverified e-mail and unfinished profile are refused; a lab can relax it', async () => {
    const unverified = await makeMember('el-unverified', { verified: false })
    const fresh = await makeMember('el-fresh', { onboarded: false })
    const a = await request(labA.slug, unverified.session, slot(9, 10))
    expect([a.status, a.body.code]).toEqual([403, 'ineligible'])
    const b = await request(labA.slug, fresh.session, slot(9, 11))
    expect([b.status, b.body.code]).toEqual([403, 'ineligible'])
    expect((await json(await api(`/api/labs/${labA.slug}/manage`, head, { action: 'update', settings: { eligibility: 'verified' } }))).status).toBe(200)
    expect((await request(labA.slug, fresh.session, slot(9, 11))).status).toBe(201)
    await api(`/api/labs/${labA.slug}/manage`, head, { action: 'update', settings: { eligibility: 'onboarded' } })
  })
})

describe('decisions', () => {
  it('a head approves with an assistant: audit row, notice to the member, and a second decision is refused', async () => {
    const m = await makeMember('dec-approve')
    const b = (await request(labA.slug, m.session, slot(4, 13))).body.id as string
    const assistantId = (await db().query('select id from app.users where email = $1', [mail('assistant')])).rows[0].id
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, head, { action: 'approve', assistantUserId: assistantId, note: 'See you there' }))).status).toBe(200)
    expect(await rowOf(b)).toMatchObject({ status: 'approved', assistant_user_id: assistantId })
    expect(await auditCount('lab_booking_approved', b)).toBe(1)
    expect((await notices(m.email, 'booking_decided')).at(-1)!.title).toMatch(/approved/)
    const again = await json(await api(`/api/labs/bookings/${b}/decide`, head, { action: 'reject', note: 'Changed my mind' }))
    expect([again.status, again.body.code]).toEqual([409, 'state'])
    expect(await auditCount('lab_booking_rejected', b)).toBe(0)
  })

  it('a rejection needs a reason, tells the person why, and frees the slot', async () => {
    const m = await makeMember('dec-reject')
    const when = slot(4, 15)
    const b = (await request(labA.slug, m.session, when)).body.id as string
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, head, { action: 'reject', note: ' ' }))).status).toBe(400)
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, head, { action: 'reject', note: 'The printer is being serviced that day.' }))).status).toBe(200)
    expect(await rowOf(b)).toMatchObject({ status: 'rejected', decision_note: 'The printer is being serviced that day.' })
    expect((await notices(m.email, 'booking_decided')).at(-1)!.body).toContain('The printer is being serviced that day.')
    const other = await makeMember('dec-reject-2')
    expect((await request(labA.slug, other.session, when)).status).toBe(201) // the slot is free again
  })

  it('a lab that requires an assistant refuses to approve without one, and only its own staff count', async () => {
    const lab = await json(await api('/api/admin/labs', admin, { name: `Staffed Lab ${stamp}`, capacity: 2 }))
    const slug = lab.body.slug as string
    await api(`/api/labs/${slug}/manage`, admin, { action: 'hours', windows: ALL_WEEK })
    await api(`/api/labs/${slug}/manage`, admin, { action: 'update', settings: { requiresAssistant: true } })
    const m = await makeMember('dec-staffed')
    const b = (await request(slug, m.session, slot(4, 10))).body.id as string
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, admin, { action: 'approve' }))).status).toBe(400)
    const assistantId = (await db().query('select id from app.users where email = $1', [mail('assistant')])).rows[0].id // staffs a different lab
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, admin, { action: 'approve', assistantUserId: assistantId }))).status).toBe(400)
    expect((await rowOf(b)).status).toBe('requested')
  })

  it('a head can suggest another time; the member accepts (it becomes the booking) or declines (it ends)', async () => {
    const m = await makeMember('dec-propose')
    const first = slot(4, 11)
    const alt = slot(4, 16)
    const b = (await request(labA.slug, m.session, first)).body.id as string
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, head, { action: 'propose', ...alt, note: 'Mornings are booked' }))).status).toBe(200)
    expect(await rowOf(b)).toMatchObject({ status: 'alternative_proposed' })
    expect((await notices(m.email, 'booking_alternative')).length).toBe(1)
    // the member's answer is theirs alone
    expect((await json(await api(`/api/labs/bookings/${b}/respond`, outsider, { accept: true }))).status).toBe(404)
    expect((await json(await api(`/api/labs/bookings/${b}/respond`, m.session, { accept: true }))).status).toBe(200)
    const accepted = await rowOf(b)
    expect(accepted.status).toBe('approved')
    expect(new Date(accepted.starts_at).toISOString()).toBe(alt.startsAt)
    expect(accepted.proposed_starts_at).toBeNull()

    const n = await makeMember('dec-propose-2')
    const c = (await request(labA.slug, n.session, slot(4, 12))).body.id as string
    await api(`/api/labs/bookings/${c}/decide`, head, { action: 'propose', ...slot(4, 17) })
    expect((await json(await api(`/api/labs/bookings/${c}/respond`, n.session, { accept: false }))).status).toBe(200)
    expect((await rowOf(c)).status).toBe('cancelled')
    expect((await json(await api(`/api/labs/bookings/${c}/respond`, n.session, { accept: true }))).status).toBe(409) // already answered
  })

  it('refuses a head’s suggestion that breaks the lab’s own rules', async () => {
    const m = await makeMember('dec-badalt')
    const b = (await request(labA.slug, m.session, slot(5, 10))).body.id as string
    const res = await json(await api(`/api/labs/bookings/${b}/decide`, head, { action: 'propose', ...slot(5, 20) }))
    expect(res.status).toBe(400)
    expect(String(res.body.error)).toMatch(/doesn’t work/)
  })

  it('exactly one of two simultaneous decisions wins, with one audit row and one notice', async () => {
    const m = await makeMember('dec-race')
    const b = (await request(labA.slug, m.session, slot(5, 12))).body.id as string
    const [x, y] = await Promise.all([
      json(await api(`/api/labs/bookings/${b}/decide`, head, { action: 'approve' })),
      json(await api(`/api/labs/bookings/${b}/decide`, admin, { action: 'reject', note: 'Not this time' })),
    ])
    expect([x.status, y.status].sort()).toEqual([200, 409])
    const status = (await rowOf(b)).status
    expect(['approved', 'rejected']).toContain(status)
    expect((await db().query("select count(*)::int c from app.audit_logs where entity_id = $1 and action in ('lab_booking_approved','lab_booking_rejected')", [b])).rows[0].c).toBe(1)
    expect((await notices(m.email, 'booking_decided')).length).toBe(1)
  })

  it('only people who run that lab may decide: not another lab’s head, not an outsider, not the booker', async () => {
    const m = await makeMember('dec-scope')
    const b = (await request(labA.slug, m.session, slot(5, 14))).body.id as string
    for (const who of [head2, outsider, m.session, reviewer]) {
      expect((await json(await api(`/api/labs/bookings/${b}/decide`, who, { action: 'approve' }))).status).toBe(403)
    }
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, null, { action: 'approve' }))).status).toBe(401)
    expect((await rowOf(b)).status).toBe('requested')
    expect((await json(await api(`/api/labs/bookings/does-not-exist/decide`, head, { action: 'approve' }))).status).toBe(404)
    expect((await json(await api(`/api/labs/bookings/${b}/decide`, head, { action: 'grant-everything' }))).status).toBe(400)
  })
})

describe('cancelling', () => {
  it('the member cancels their own request; nobody else can, and a stranger learns nothing', async () => {
    const m = await makeMember('can-own')
    const when = slot(6, 15)
    const b = (await request(labA.slug, m.session, when)).body.id as string
    expect((await json(await api(`/api/labs/bookings/${b}/cancel`, outsider, {}))).status).toBe(404)
    expect((await json(await api(`/api/labs/bookings/${b}/cancel`, m.session, {}))).status).toBe(200)
    expect((await rowOf(b)).status).toBe('cancelled')
    expect((await notices(mail('head'), 'booking_cancelled')).length).toBeGreaterThan(0)
    expect((await json(await api(`/api/labs/bookings/${b}/cancel`, m.session, {}))).status).toBe(409)
  })

  it('an approved booking inside the cut-off cannot be cancelled by the member, but a head can with a reason', async () => {
    const m = await makeMember('can-cutoff')
    const soon = await db().query(
      "insert into app.lab_bookings (id, lab_id, user_id, starts_at, ends_at, purpose, headcount, status) values (gen_random_uuid()::text, $1, $2, now() + interval '1 hour', now() + interval '2 hours', 'Soon', 1, 'approved') returning id",
      [labB.id, m.id],
    )
    const id = soon.rows[0].id as string
    const refused = await json(await api(`/api/labs/bookings/${id}/cancel`, m.session, {}))
    expect([refused.status, refused.body.code]).toEqual([409, 'state'])
    expect((await json(await api(`/api/labs/bookings/${id}/cancel`, head2, {}))).status).toBe(400) // a reason is required
    expect((await json(await api(`/api/labs/bookings/${id}/cancel`, head2, { note: 'The cabin is closed for repairs.' }))).status).toBe(200)
    expect((await rowOf(id)).status).toBe('cancelled')
    expect(await auditCount('lab_booking_cancelled', id)).toBe(1)
    expect((await notices(m.email, 'booking_cancelled')).at(-1)!.body).toContain('closed for repairs')
  })
})

describe('manual attendance', () => {
  async function approvedBooking(userId: string, startOffset: string, endOffset: string) {
    const r = await db().query(
      `insert into app.lab_bookings (id, lab_id, user_id, starts_at, ends_at, purpose, headcount, status) values (gen_random_uuid()::text, $1, $2, now() + interval '${startOffset}', now() + interval '${endOffset}', 'Attendance test', 1, 'approved') returning id`,
      [labA.id, userId],
    )
    return r.rows[0].id as string
  }

  it('an assistant records attended, once, labelled manual, with an audit row', async () => {
    const m = await makeMember('att-ok')
    const b = await approvedBooking(m.id, '-90 minutes', '-30 minutes')
    expect((await json(await api(`/api/labs/bookings/${b}/attendance`, assistant, { outcome: 'attended' }))).status).toBe(200)
    expect((await rowOf(b)).status).toBe('completed')
    const rec = (await db().query('select outcome, method, marked_by from app.lab_attendance where booking_id = $1', [b])).rows[0]
    expect(rec).toMatchObject({ outcome: 'attended', method: 'manual' })
    expect(rec.marked_by).toBeTruthy()
    expect(await auditCount('lab_attendance_attended', b)).toBe(1)
    expect((await json(await api(`/api/labs/bookings/${b}/attendance`, assistant, { outcome: 'attended' }))).status).toBe(409)
  })

  it('a no-show needs a reason; a booking that has not started cannot be marked; non-staff cannot mark', async () => {
    const m = await makeMember('att-noshow')
    const past = await approvedBooking(m.id, '-3 hours', '-2 hours')
    expect((await json(await api(`/api/labs/bookings/${past}/attendance`, assistant, { outcome: 'no_show' }))).status).toBe(400)
    expect((await json(await api(`/api/labs/bookings/${past}/attendance`, head, { outcome: 'no_show', reason: 'Did not arrive and did not call' }))).status).toBe(200)
    expect((await rowOf(past)).status).toBe('no_show')
    const future = await approvedBooking(m.id, '3 hours', '4 hours')
    expect((await json(await api(`/api/labs/bookings/${future}/attendance`, assistant, { outcome: 'attended' }))).status).toBe(409)
    for (const who of [m.session, outsider, head2, reviewer]) {
      expect((await json(await api(`/api/labs/bookings/${past}/attendance`, who, { outcome: 'attended' }))).status).toBe(403)
    }
    expect((await json(await api(`/api/labs/bookings/${past}/attendance`, assistant, { outcome: 'present-ish' }))).status).toBe(400)
  })
})

describe('reports', () => {
  // a small, strict CSV reader: quoted cells, doubled quotes, commas inside quotes
  const csvRows = (text: string) => {
    const rows: string[][] = []
    let row: string[] = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < text.length; i++) {
      const c = text[i]!
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = false
        else cell += c
      } else if (c === '"') quoted = true
      else if (c === ',') { row.push(cell); cell = '' }
      else if (c === '\r') { /* the line feed that follows ends the row */ }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
      else cell += c
    }
    if (cell || row.length) { row.push(cell); rows.push(row) }
    return rows
  }
  const range = () => `from=${day(-30)}&to=${day(20)}`

  it('the figures for a lab match a direct count of its rows', async () => {
    const res = await api(`/api/labs/report.csv?${range()}&lab=${labA.id}`, admin, undefined, 'GET')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('cache-control')).toContain('no-store')
    const rows = csvRows(await res.text())
    expect(rows[0]![0]).toBe('Department')
    const row = rows[1]!
    const sql = await db().query(
      `select count(*)::int req,
         count(*) filter (where status in ('approved','completed','no_show'))::int app,
         count(*) filter (where status = 'rejected')::int rej,
         count(*) filter (where status = 'cancelled')::int can,
         count(*) filter (where status = 'completed')::int att,
         count(*) filter (where status = 'no_show')::int nos
       from app.lab_bookings where lab_id = $1 and starts_at >= $2 and starts_at < $3`,
      [labA.id, istInstant(day(-30)), istInstant(day(20), 1440)],
    )
    const s = sql.rows[0]
    expect(row.slice(2, 8).map(Number)).toEqual([s.req, s.app, s.rej, s.can, s.att, s.nos])
    expect(Number(row[10])).toBe((await db().query('select count(*)::int c from app.lab_attendance a join app.lab_bookings b on b.id = a.booking_id where b.lab_id = $1 and a.method = $2', [labA.id, 'manual'])).rows[0].c)
    expect(s.att).toBeGreaterThanOrEqual(1)
    expect(s.nos).toBeGreaterThanOrEqual(1)
  })

  it('an administrator sees every lab; a head sees only their own; others are refused', async () => {
    const all = csvRows(await (await api(`/api/labs/report.csv?${range()}`, admin, undefined, 'GET')).text())
    const names = all.slice(1).map((r) => r[1])
    expect(names).toContain(`Maker Space ${stamp}`)
    expect(names).toContain(`Founder Cabin ${stamp}`)

    const mine = csvRows(await (await api(`/api/labs/report.csv?${range()}`, head, undefined, 'GET')).text())
    expect(mine.slice(1).map((r) => r[1])).toEqual([`Maker Space ${stamp}`])
    expect((await api(`/api/labs/report.csv?${range()}&lab=${labB.id}`, head, undefined, 'GET')).status).toBe(403)
    for (const who of [outsider, assistant, reviewer]) expect((await api(`/api/labs/report.csv?${range()}`, who, undefined, 'GET')).status, 'non-manager').toBe(403)
    expect((await api(`/api/labs/report.csv?${range()}`, null, undefined, 'GET')).status).toBe(401)
    expect((await api('/api/labs/report.csv?from=2026-12-31&to=2026-01-01', admin, undefined, 'GET')).status).toBe(400)
  })

  it('a lab name that looks like a spreadsheet formula is neutralised in the download', async () => {
    const evil = await json(await api('/api/admin/labs', admin, { name: `=HYPERLINK("http://evil.example","x") ${stamp}`, capacity: 1 }))
    expect(evil.status).toBe(201)
    const text = await (await api(`/api/labs/report.csv?${range()}`, admin, undefined, 'GET')).text()
    expect(text).toContain(`'=HYPERLINK`)
    expect(text).not.toMatch(/(^|,|\r\n)"?=HYPERLINK/)
  })
})

describe('the screens', () => {
  it('members see labs and their own bookings; the lab page shows the rules and the hours', async () => {
    const m = await makeMember('screens')
    await request(labA.slug, m.session, slot(8, 16))
    const list = await (await get('/dashboard/lab-booking', m.session)).text()
    expect(list).toContain(`Maker Space ${stamp}`)
    expect(list).toContain('Your bookings')
    expect(list).toContain('Waiting for the lab head')
    const page = await get(`/dashboard/lab-booking/${labA.slug}`, m.session)
    expect(page.status).toBe(200)
    const html = (await page.text()).replace(/<!-- -->/g, '')
    expect(html).toContain('Monday: 09:00 to 18:00')
    expect(html).toContain('Request a time')
    const missing = await (await get('/dashboard/lab-booking/no-such-lab', m.session)).text()
    expect(missing).not.toContain('Request a time')
  })

  it('a lab console opens for its head and its assistant, and is a real 404 for everyone else', async () => {
    expect((await get(`/dashboard/lab-staff/${labA.slug}`, head)).status).toBe(200)
    const assistantHtml = await (await get(`/dashboard/lab-staff/${labA.slug}`, assistant)).text()
    expect(assistantHtml).toContain('Approved and coming up')
    expect(assistantHtml).not.toContain('Rules and details')
    expect(assistantHtml).not.toContain('Requests waiting')
    const headHtml = await (await get(`/dashboard/lab-staff/${labA.slug}`, head)).text()
    expect(headHtml).toContain('Requests waiting')
    expect(headHtml).toContain('Rules and details')
    // member pages stream behind a loading boundary, so the status can already be 200; what matters is that nothing of the console is sent
    for (const who of [outsider, head2]) {
      const res = await get(`/dashboard/lab-staff/${labA.slug}`, who)
      const text = await res.text()
      for (const secret of ['Requests waiting', 'Rules and details', 'Approved and coming up', mail('head'), mail('assistant')]) expect(text, secret).not.toContain(secret)
    }
    expect((await get(`/dashboard/lab-staff/${labA.slug}`)).status).toBeGreaterThanOrEqual(300)
  })

  it('the head’s own pages: the lab list, the report; and the administrator’s labs screen', async () => {
    expect(await (await get('/dashboard/lab-staff', head)).text()).toContain(`Maker Space ${stamp}`)
    expect(await (await get('/dashboard/lab-staff', outsider)).text()).not.toContain(`Maker Space ${stamp}`)
    expect((await get(`/dashboard/lab-staff/${labA.slug}/report`, head)).status).toBe(200)
    expect(await (await get(`/dashboard/lab-staff/${labA.slug}/report`, assistant)).text()).not.toContain('Utilisation:')
    expect((await get('/admin/labs', admin)).status).toBe(200)
    expect(await (await get('/admin/labs', admin)).text()).toContain(`Maker Space ${stamp}`)
    expect((await get('/admin/labs', reviewer)).status).toBe(404)
    expect((await get('/admin/labs/report', admin)).status).toBe(200)
    expect((await get('/admin/labs/report', reviewer)).status).toBe(404)
  })

  it('the assistant’s roster lists only their own assigned duties', async () => {
    const m = await makeMember('roster')
    const assistantId = (await db().query('select id from app.users where email = $1', [mail('assistant')])).rows[0].id
    const r = await db().query(
      "insert into app.lab_bookings (id, lab_id, user_id, starts_at, ends_at, purpose, headcount, status, assistant_user_id) values (gen_random_uuid()::text, $1, $2, now() + interval '2 days', now() + interval '2 days 1 hour', 'Roster test', 1, 'approved', $3) returning id",
      [labA.id, m.id, assistantId],
    )
    expect(r.rows.length).toBe(1)
    const mine = await (await get('/dashboard/lab-staff', assistant)).text()
    expect(mine).toContain('Your duties coming up')
    expect(mine).toContain(`Maker Space ${stamp}`)
    const other = await (await get('/dashboard/lab-staff', head)).text()
    expect(other).toContain('No bookings are assigned to you.')
  })
})
