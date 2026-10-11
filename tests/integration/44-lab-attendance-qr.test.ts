import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { STEP_MS } from '../../src/lib/lab-qr/constants'
import { toBase64Url } from '../../src/lib/lab-qr/encoding'
import { newDevice, type TestDevice } from '../../src/lib/lab-qr/testing'
import { createChallenge, createPass, createRegistrationProof, createScanEvent } from '../../src/lib/lab-qr/tokens'
import { closeDb, createUser, db, login, uniqueIp, type Session } from '../support/helpers'
import { BASE } from '../support/helpers'

/**
 * QR attendance, end to end on the production build and a real database: key registration and
 * revocation, the two-sided exchange with server-side decision and pairing, replay and forgery
 * refusal, clock-skew review, roster scoping, and idempotent batches under parallel load.
 * The protocol itself is unit-tested in src/lib/lab-qr; this file proves the database and routes.
 * What it cannot prove is behaviour on real phones (see docs/delivery/LAB-DEVICE-TEST-PROTOCOL.md).
 */

const stamp = Date.now()
const mail = (n: string) => `${n}-${stamp}@qr.test`

let admin: Session
let head: Session
let assistant: Session
let assistant2: Session
let stranger: Session
let labSlug: string
let headId: string
let assistantId: string
let assistant2Id: string
let assistantDevice: TestDevice
let assistant2Device: TestDevice
let headDevice: TestDevice
let strangerDevice: TestDevice

const api = (path: string, who: Session | null, body?: unknown, method = 'POST') =>
  fetch(`${BASE()}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp(), ...(who ? { cookie: who.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>
const json = async (res: Response) => ({ status: res.status, body: (await res.json().catch(() => ({}))) as Body })

async function makeUser(tag: string) {
  const email = mail(tag)
  const id = await createUser({ email, platformRole: 'student' })
  await db().query('update app.users set onboarding_completed_at = now() where id = $1', [id])
  return { id, email, session: (await login(email))! }
}

async function register(who: Session, userId: string, device: TestDevice, label = 'test phone') {
  const proof = await createRegistrationProof({ userId, keyId: device.keyId, nowMs: Date.now() }, device.privateKey)
  return json(await api('/api/lab-attendance/keys', who, { publicKey: toBase64Url(device.publicKeyRaw), proof, label }))
}

type Booker = Awaited<ReturnType<typeof makeBooker>>
/** A member with a registered device and an approved booking running now, assigned to the first assistant. */
async function makeBooker(tag: string, opts: { assigned?: string | null; status?: string; startOffsetMin?: number } = {}) {
  const user = await makeUser(tag)
  const device = await newDevice(user.id)
  expect((await register(user.session, user.id, device)).status).toBe(201)
  const start = new Date(Date.now() + (opts.startOffsetMin ?? -10) * 60_000)
  const end = new Date(start.getTime() + 60 * 60_000)
  const assigned = opts.assigned === undefined ? assistantId : opts.assigned
  // One lab per booking: the database refuses overlapping live bookings of one lab, and every
  // exchange here happens "now". Staff are the same three people in each.
  const lab = await db().query("insert into app.labs (id, slug, name) values (gen_random_uuid()::text, $1, $1) returning id", [`qr-${stamp}-${tag}`])
  const bookingLabId = lab.rows[0].id as string
  for (const [uid, role] of [[headId, 'head'], [assistantId, 'assistant'], [assistant2Id, 'assistant']] as const) {
    await db().query("insert into app.lab_staff (id, lab_id, user_id, role) values (gen_random_uuid()::text, $1, $2, $3)", [bookingLabId, uid, role])
  }
  const res = await db().query(
    `insert into app.lab_bookings (id, lab_id, user_id, starts_at, ends_at, purpose, headcount, status, assistant_user_id)
     values (gen_random_uuid()::text, $1, $2, $3, $4, 'Prototype testing for my project', 1, $5, $6) returning id`,
    [bookingLabId, user.id, start, end, opts.status ?? 'approved', assigned],
  )
  return { ...user, device, bookingId: res.rows[0].id as string, labId: bookingLabId }
}

const staffEvent = async (b: Booker, scanner: TestDevice, over: { at?: number; action?: 'in' | 'out'; passAt?: number; passKey?: TestDevice; id?: string } = {}) => {
  const at = over.at ?? Date.now()
  const action = over.action ?? 'in'
  const pass = await createPass({ action, bookingId: b.bookingId, keyId: (over.passKey ?? b.device).keyId, nowMs: over.passAt ?? at }, (over.passKey ?? b.device).privateKey)
  const id = over.id ?? crypto.randomUUID()
  const token = await createScanEvent({ id, side: 'staff', action, keyId: scanner.keyId, atMs: at, bookingId: b.bookingId, scanned: pass, offline: true }, scanner.privateKey)
  return { id, token, pass }
}
const studentEvent = async (b: Booker, deskDevice: TestDevice, over: { at?: number; action?: 'in' | 'out'; id?: string } = {}) => {
  const at = over.at ?? Date.now()
  const action = over.action ?? 'in'
  const chal = await createChallenge({ mode: action, labId: b.labId, keyId: deskDevice.keyId, nowMs: at }, deskDevice.privateKey)
  const id = over.id ?? crypto.randomUUID()
  const token = await createScanEvent({ id, side: 'student', action, keyId: b.device.keyId, atMs: at, bookingId: b.bookingId, scanned: chal, offline: true }, b.device.privateKey)
  return { id, token, chal }
}
const send = async (who: Session, events: string[], clientNowMs = Date.now()) => json(await api('/api/lab-attendance/scans', who, { clientNowMs, events }))
const result = (r: { body: Body }, i = 0) => r.body.results[i] as { id: string; status: string; code: string | null; check: { state: string } | null; duplicate: boolean }
const attendanceRows = async (bookingId: string) => (await db().query('select * from app.lab_attendance where booking_id = $1', [bookingId])).rows
const bookingStatus = async (bookingId: string) => (await db().query('select status from app.lab_bookings where id = $1', [bookingId])).rows[0].status as string

beforeAll(async () => {
  await createUser({ email: mail('admin'), platformRole: 'other', staffRole: 'lab_admin' })
  admin = (await login(mail('admin')))!
  const h = await makeUser('head')
  const a = await makeUser('assistant')
  const a2 = await makeUser('assistant2')
  const s = await makeUser('stranger')
  head = h.session
  assistant = a.session
  assistant2 = a2.session
  stranger = s.session
  headId = h.id
  assistantId = a.id
  assistant2Id = a2.id
  const lab = await json(await api('/api/admin/labs', admin, { name: `QR Lab ${stamp}`, department: 'Engineering', capacity: 4 }))
  expect(lab.status).toBe(201)
  labSlug = lab.body.slug
  for (const [email, role] of [[h.email, 'head'], [a.email, 'assistant'], [a2.email, 'assistant']] as const) {
    expect((await json(await api(`/api/labs/${labSlug}/manage`, admin, { action: 'staff-add', staff: { email, role } }))).status).toBe(200)
  }
  headDevice = await newDevice(h.id)
  assistantDevice = await newDevice(a.id)
  assistant2Device = await newDevice(a2.id)
  strangerDevice = await newDevice(s.id)
  for (const [who, id, dev] of [[head, h.id, headDevice], [assistant, a.id, assistantDevice], [assistant2, a2.id, assistant2Device], [stranger, s.id, strangerDevice]] as const) {
    expect((await register(who, id, dev)).status).toBe(201)
  }
})
afterAll(closeDb)

describe('device keys', () => {
  it('need a sign-in', async () => {
    expect((await api('/api/lab-attendance/keys', null, undefined, 'GET')).status).toBe(401)
    expect((await api('/api/lab-attendance/roster', null, undefined, 'GET')).status).toBe(401)
    expect((await api('/api/lab-attendance/scans', null, { clientNowMs: Date.now(), events: ['x'] })).status).toBe(401)
  })

  it('tell a device who it is working for and list its bookings', async () => {
    const b = await makeBooker('me-a')
    const me = await json(await api('/api/lab-attendance/me', b.session, undefined, 'GET'))
    expect(me.body).toMatchObject({ ok: true, userId: b.id, isStaff: false })
    expect((await json(await api('/api/lab-attendance/me', assistant, undefined, 'GET'))).body.isStaff).toBe(true)
    const passes = await json(await api('/api/lab-attendance/passes', b.session, undefined, 'GET'))
    const mine = (passes.body.passes as { bookingId: string; staffKeys: { keyId: string }[] }[]).find((p) => p.bookingId === b.bookingId)!
    expect(mine.staffKeys.map((k) => k.keyId)).toEqual(expect.arrayContaining([assistantDevice.keyId]))
    expect((await api('/api/lab-attendance/me', null, undefined, 'GET')).status).toBe(401)
  })

  it('register once, idempotently, with a proof bound to the account', async () => {
    const u = await makeUser('keys-a')
    const device = await newDevice(u.id)
    const first = await register(u.session, u.id, device)
    expect(first.status).toBe(201)
    expect(first.body.key.id).toBe(device.keyId)
    expect((await register(u.session, u.id, device)).status).toBe(201) // same person, same key: no error
    expect((await db().query('select count(*)::int c from app.lab_device_keys where id = $1', [device.keyId])).rows[0].c).toBe(1)

    // someone else cannot register the same public key under their account
    const thief = await makeUser('keys-thief')
    const stolen = await register(thief.session, thief.id, device)
    expect([stolen.status, stolen.body.code]).toEqual([409, 'conflict'])
  })

  it('refuse a proof made for another account, a bad key, a garbled proof and a stale proof', async () => {
    const u = await makeUser('keys-b')
    const other = await makeUser('keys-c')
    const device = await newDevice(u.id)
    const forOther = await createRegistrationProof({ userId: other.id, keyId: device.keyId, nowMs: Date.now() }, device.privateKey)
    const r1 = await json(await api('/api/lab-attendance/keys', u.session, { publicKey: toBase64Url(device.publicKeyRaw), proof: forOther }))
    expect([r1.status, r1.body.code]).toEqual([403, 'forbidden'])
    const stale = await createRegistrationProof({ userId: u.id, keyId: device.keyId, nowMs: Date.now() - 10 * 60_000 }, device.privateKey)
    expect((await json(await api('/api/lab-attendance/keys', u.session, { publicKey: toBase64Url(device.publicKeyRaw), proof: stale }))).status).toBe(400)
    expect((await json(await api('/api/lab-attendance/keys', u.session, { publicKey: 'AAAA', proof: 'x' }))).status).toBe(400)
    expect((await json(await api('/api/lab-attendance/keys', u.session, { publicKey: toBase64Url(device.publicKeyRaw), proof: 'K1.AA.AA' }))).status).toBe(400)
    // proof signed by a different private key than the one being registered
    const impostor = await newDevice(u.id)
    const wrongSigner = await createRegistrationProof({ userId: u.id, keyId: device.keyId, nowMs: Date.now() }, impostor.privateKey)
    expect((await json(await api('/api/lab-attendance/keys', u.session, { publicKey: toBase64Url(device.publicKeyRaw), proof: wrongSigner }))).status).toBe(400)
  })

  it('are capped at five active keys per person', async () => {
    const u = await makeUser('keys-cap')
    for (let i = 0; i < 5; i++) expect((await register(u.session, u.id, await newDevice(u.id))).status).toBe(201)
    const sixth = await register(u.session, u.id, await newDevice(u.id))
    expect([sixth.status, sixth.body.code]).toEqual([409, 'limit'])
  })
})

describe('the two-sided exchange', () => {
  it('one side is only partially recorded; both sides, accepted by the server, make it verified and record attendance as qr', async () => {
    const b = await makeBooker('ex-a')
    const staff = await staffEvent(b, assistantDevice)
    const first = await send(assistant, [staff.token])
    expect(first.status).toBe(200)
    expect(result(first)).toMatchObject({ status: 'accepted', check: { state: 'partial' } })
    expect(await attendanceRows(b.bookingId)).toHaveLength(0)
    expect(await bookingStatus(b.bookingId)).toBe('approved')

    const student = await studentEvent(b, assistantDevice)
    const second = await send(b.session, [student.token])
    expect(result(second)).toMatchObject({ status: 'accepted', check: { state: 'verified' } })

    const rows = await attendanceRows(b.bookingId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ outcome: 'attended', method: 'qr' })
    expect(await bookingStatus(b.bookingId)).toBe('completed')
    const audit = await db().query("select count(*)::int c from app.audit_logs where action = 'lab_qr_in_verified' and entity_id = $1", [b.bookingId])
    expect(audit.rows[0].c).toBe(1)

    // both signed tokens are kept for a later dispute
    const events = await db().query('select side, status, token from app.lab_scan_events where booking_id = $1 order by side', [b.bookingId])
    expect(events.rows.map((r) => r.side)).toEqual(['staff', 'student'])
    expect(events.rows.every((r) => r.status === 'accepted' && String(r.token).startsWith('K1.'))).toBe(true)

    // the booker's page reads verified only from the server
    const state = await json(await api(`/api/lab-attendance/bookings/${b.bookingId}/checks`, b.session, undefined, 'GET'))
    expect(state.body.checks).toMatchObject({ in: 'verified', out: 'none' })
  })

  it('check-out is its own exchange and does not disturb the attendance row', async () => {
    const b = await makeBooker('ex-out')
    await send(assistant, [(await staffEvent(b, assistantDevice)).token])
    await send(b.session, [(await studentEvent(b, assistantDevice)).token])
    const out = await staffEvent(b, assistantDevice, { action: 'out' })
    expect(result(await send(assistant, [out.token]))).toMatchObject({ status: 'accepted', check: { state: 'partial' } })
    const outStudent = await studentEvent(b, assistantDevice, { action: 'out' })
    expect(result(await send(b.session, [outStudent.token]))).toMatchObject({ status: 'accepted', check: { state: 'verified' } })
    expect(await attendanceRows(b.bookingId)).toHaveLength(1)
    const state = await json(await api(`/api/lab-attendance/bookings/${b.bookingId}/checks`, b.session, undefined, 'GET'))
    expect(state.body.checks).toMatchObject({ in: 'verified', out: 'verified' })
  })

  it('a manual row that exists already is never overwritten by a verified scan', async () => {
    const b = await makeBooker('ex-manual')
    await db().query("insert into app.lab_attendance (id, booking_id, outcome, marked_by, method, reason) values (gen_random_uuid()::text, $1, 'attended', $2, 'manual', 'by hand')", [b.bookingId, assistantId])
    await send(assistant, [(await staffEvent(b, assistantDevice)).token])
    await send(b.session, [(await studentEvent(b, assistantDevice)).token])
    const rows = await attendanceRows(b.bookingId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ method: 'manual', reason: 'by hand' })
  })

  it('is idempotent: the same event again returns the stored answer and adds nothing', async () => {
    const b = await makeBooker('ex-idem')
    const staff = await staffEvent(b, assistantDevice)
    expect(result(await send(assistant, [staff.token])).duplicate).toBe(false)
    const again = await send(assistant, [staff.token])
    expect(result(again)).toMatchObject({ status: 'accepted', duplicate: true })
    expect((await db().query('select count(*)::int c from app.lab_scan_events where booking_id = $1', [b.bookingId])).rows[0].c).toBe(1)
  })

  it('refuses a replay of a captured pass under a new event id, and a captured event from another device', async () => {
    const b = await makeBooker('ex-replay')
    const staff = await staffEvent(b, assistantDevice)
    expect(result(await send(assistant, [staff.token])).status).toBe('accepted')
    // the same pass, new event id: the nonce is single use
    const reused = await createScanEvent(
      { id: crypto.randomUUID(), side: 'staff', action: 'in', keyId: assistantDevice.keyId, atMs: Date.now(), bookingId: b.bookingId, scanned: staff.pass, offline: true },
      assistantDevice.privateKey,
    )
    expect(result(await send(assistant, [reused]))).toMatchObject({ status: 'rejected', code: 'replay' })
    // a second assistant (or anyone) submitting the first assistant's event bytes
    const b2 = await makeBooker('ex-replay-2')
    const captured = await staffEvent(b2, assistantDevice)
    expect(result(await send(assistant2, [captured.token]))).toMatchObject({ status: 'rejected', code: 'not-your-key' })
    expect(result(await send(b2.session, [captured.token]))).toMatchObject({ status: 'rejected', code: 'not-your-key' })
    // and it still counts once for its owner
    expect(result(await send(assistant, [captured.token])).status).toBe('accepted')
  })

  it('refuses forged and misdirected events', async () => {
    const b = await makeBooker('ex-forge')
    // a pass signed by the assistant but naming the student's key
    const forgedPass = await createPass({ action: 'in', bookingId: b.bookingId, keyId: b.device.keyId, nowMs: Date.now() }, assistantDevice.privateKey)
    const forged = await createScanEvent({ id: crypto.randomUUID(), side: 'staff', action: 'in', keyId: assistantDevice.keyId, atMs: Date.now(), bookingId: b.bookingId, scanned: forgedPass, offline: true }, assistantDevice.privateKey)
    expect(result(await send(assistant, [forged]))).toMatchObject({ status: 'rejected', code: 'bad-signature' })
    // a stranger who is not staff of the lab scanning a real pass
    expect(result(await send(stranger, [(await staffEvent(b, strangerDevice)).token]))).toMatchObject({ status: 'rejected', code: 'not-staff' })
    // an assistant who is not assigned to this booking
    expect(result(await send(assistant2, [(await staffEvent(b, assistant2Device)).token]))).toMatchObject({ status: 'rejected', code: 'not-assigned' })
    // the head may scan any booking of the lab
    expect(result(await send(head, [(await staffEvent(b, headDevice)).token])).status).toBe('accepted')
    // garbage and over-long input
    expect(result(await send(assistant, ['not-a-token'])).code).toBe('malformed')
    expect((await send(assistant, [])).status).toBe(400)
    expect((await send(assistant, Array.from({ length: 51 }, () => 'x'))).status).toBe(400)
    expect((await json(await api('/api/lab-attendance/scans', assistant, { events: ['x'] }))).status).toBe(400)
    // nothing was recorded as attendance by a rejected exchange
    expect((await db().query("select count(*)::int c from app.lab_scan_events where booking_id = $1 and status = 'accepted'", [b.bookingId])).rows[0].c).toBe(1)
  })

  it('refuses a photographed pass shown after its step, and bookings that are not approved', async () => {
    const b = await makeBooker('ex-shot')
    const old = await staffEvent(b, assistantDevice, { passAt: Date.now() - 5 * 60_000 })
    expect(result(await send(assistant, [old.token]))).toMatchObject({ status: 'rejected', code: 'expired' })
    const cancelled = await makeBooker('ex-cancelled', { status: 'cancelled' })
    expect(result(await send(assistant, [(await staffEvent(cancelled, assistantDevice)).token]))).toMatchObject({ status: 'rejected', code: 'booking-not-attendable' })
    const later = await makeBooker('ex-later', { startOffsetMin: 180 })
    expect(result(await send(assistant, [(await staffEvent(later, assistantDevice)).token]))).toMatchObject({ status: 'rejected', code: 'outside-slot' })
  })

  it('yields exactly one verified check and one attendance row when both halves arrive at once', async () => {
    const b = await makeBooker('ex-race')
    const staff = await staffEvent(b, assistantDevice)
    const student = await studentEvent(b, assistantDevice)
    const [r1, r2] = await Promise.all([send(assistant, [staff.token]), send(b.session, [student.token])])
    expect(result(r1).status).toBe('accepted')
    expect(result(r2).status).toBe('accepted')
    const checks = await db().query("select state from app.lab_qr_checks where booking_id = $1 and action = 'in'", [b.bookingId])
    expect(checks.rows).toEqual([{ state: 'verified' }])
    expect(await attendanceRows(b.bookingId)).toHaveLength(1)
  })

  it('takes a batch of 40 events from one outbox, in parallel twice, and stores each once', async () => {
    const bookers = await Promise.all(Array.from({ length: 40 }, (_, i) => makeBooker(`batch${i}`)))
    const tokens = await Promise.all(bookers.map(async (b) => (await staffEvent(b, assistantDevice)).token))
    const [x, y] = await Promise.all([send(assistant, tokens), send(assistant, tokens)])
    expect(x.status).toBe(200)
    expect(y.status).toBe(200)
    expect(x.body.results).toHaveLength(40)
    const ids = bookers.map((b) => b.bookingId)
    const rows = await db().query("select count(*)::int c from app.lab_scan_events where booking_id = any($1) and status = 'accepted'", [ids])
    expect(rows.rows[0].c).toBe(40)
  })
})

describe('clock skew and the head review queue', () => {
  it('holds a scan from a clock that is far off, lets the head decide it, and only the head', async () => {
    const b = await makeBooker('skew-a')
    const skew = 60 * 60_000
    // the assistant phone runs an hour fast: its scan time and its batch time are both an hour ahead
    const at = Date.now() + skew
    const staff = await staffEvent(b, assistantDevice, { at, passAt: Date.now() })
    const held = await send(assistant, [staff.token], Date.now() + skew)
    expect(result(held)).toMatchObject({ status: 'review', code: 'clock-skew' })
    expect(await attendanceRows(b.bookingId)).toHaveLength(0)

    const queue = await json(await api(`/api/lab-attendance/reviews?labId=${b.labId}`, head, undefined, 'GET'))
    const item = (queue.body.events as { id: string; code: string }[]).find((e) => e.id === staff.id)
    expect(item).toMatchObject({ code: 'clock-skew' })
    expect(JSON.stringify(queue.body)).not.toContain('@qr.test')

    // assistants, members and strangers cannot read or decide
    expect((await api(`/api/lab-attendance/reviews?labId=${b.labId}`, assistant, undefined, 'GET')).status).toBe(403)
    expect((await api(`/api/lab-attendance/reviews/${staff.id}`, assistant, { approve: true, note: 'fine' })).status).toBe(403)
    expect((await api(`/api/lab-attendance/reviews/${staff.id}`, stranger, { approve: true, note: 'fine' })).status).toBe(403)
    expect((await json(await api(`/api/lab-attendance/reviews/${staff.id}`, head, { approve: true, note: '' }))).status).toBe(400)

    // the student half arrives normally; the check stays partial until the head approves the held half
    const student = await studentEvent(b, assistantDevice)
    expect(result(await send(b.session, [student.token]))).toMatchObject({ status: 'accepted', check: { state: 'partial' } })
    expect((await json(await api(`/api/lab-attendance/reviews/${staff.id}`, head, { approve: true, note: 'Phone clock was wrong, student was present' }))).status).toBe(200)
    expect((await db().query("select state from app.lab_qr_checks where booking_id = $1 and action = 'in'", [b.bookingId])).rows[0].state).toBe('verified')
    expect(await attendanceRows(b.bookingId)).toHaveLength(1)
    expect((await json(await api(`/api/lab-attendance/reviews/${staff.id}`, head, { approve: true, note: 'again' }))).status).toBe(409)
    expect((await db().query("select count(*)::int c from app.audit_logs where action = 'lab_qr_review_approved' and entity_id = $1", [staff.id])).rows[0].c).toBe(1)
  })

  it('declining a held scan records why and never counts it', async () => {
    const b = await makeBooker('skew-b')
    const at = Date.now() + 30 * 60_000
    const staff = await staffEvent(b, assistantDevice, { at, passAt: Date.now() })
    expect(result(await send(assistant, [staff.token], Date.now() + 30 * 60_000)).status).toBe('review')
    expect((await json(await api(`/api/lab-attendance/reviews/${staff.id}`, head, { approve: false, note: 'Student was not in the lab' }))).status).toBe(200)
    const row = (await db().query('select status, code, review_note from app.lab_scan_events where id = $1', [staff.id])).rows[0]
    expect(row).toMatchObject({ status: 'rejected', code: 'review-declined', review_note: 'Student was not in the lab' })
    expect(await attendanceRows(b.bookingId)).toHaveLength(0)
  })
})

describe('key revocation', () => {
  it('a revoked key is refused from then on, and its owner decides when to revoke', async () => {
    const b = await makeBooker('rev-a')
    const before = await staffEvent(b, assistantDevice)
    expect(result(await send(assistant, [before.token])).status).toBe('accepted')
    expect((await json(await api(`/api/lab-attendance/keys/${b.device.keyId}/revoke`, stranger, { reason: 'because' }))).status).toBe(403)
    expect((await json(await api(`/api/lab-attendance/keys/${b.device.keyId}/revoke`, b.session, { reason: 'Lost my phone' }))).status).toBe(200)
    // a pass made after the revocation is refused
    await new Promise((r) => setTimeout(r, 1100))
    const after = await staffEvent(b, assistantDevice, { action: 'in', id: crypto.randomUUID() })
    expect(result(await send(assistant, [after.token]))).toMatchObject({ status: 'rejected', code: 'key-revoked' })
    expect((await db().query('select revoked_reason from app.lab_device_keys where id = $1', [b.device.keyId])).rows[0].revoked_reason).toBe('Lost my phone')
    // a revoked key cannot be registered again
    expect((await register(b.session, b.id, b.device)).status).toBe(403)
  })

  it('a lab head can revoke the key of a person who booked their lab; a stranger cannot', async () => {
    const b = await makeBooker('rev-b')
    const noReason = await json(await api(`/api/lab-attendance/keys/${b.device.keyId}/revoke`, head, {}))
    expect(noReason.status).toBe(400)
    const ok = await json(await api(`/api/lab-attendance/keys/${b.device.keyId}/revoke`, head, { reason: 'Student lost the phone' }))
    expect(ok.status).toBe(200)
    expect((await db().query('select revoked_by from app.lab_device_keys where id = $1', [b.device.keyId])).rows[0].revoked_by).toBe(headId)
    expect((await json(await api('/api/lab-attendance/keys/does-not-exist/revoke', head, { reason: 'xyz' }))).status).toBe(404)
  })
})

describe('roster and pass context', () => {
  it('an assistant sees only assigned bookings, a head sees the lab, a member sees nothing, and no e-mail leaves', async () => {
    const mine = await makeBooker('rost-a', { assigned: assistantId })
    const theirs = await makeBooker('rost-b', { assigned: assistant2Id })
    const asA = await json(await api('/api/lab-attendance/roster', assistant, undefined, 'GET'))
    expect(asA.status).toBe(200)
    const idsA = (asA.body.entries as { bookingId: string }[]).map((e) => e.bookingId)
    expect(idsA).toContain(mine.bookingId)
    expect(idsA).not.toContain(theirs.bookingId)
    const asHead = await json(await api('/api/lab-attendance/roster', head, undefined, 'GET'))
    const idsH = (asHead.body.entries as { bookingId: string }[]).map((e) => e.bookingId)
    expect(idsH).toEqual(expect.arrayContaining([mine.bookingId, theirs.bookingId]))
    expect(JSON.stringify(asHead.body)).not.toContain('@qr.test')
    const entry = (asA.body.entries as { bookingId: string; studentKeys: { keyId: string }[] }[]).find((e) => e.bookingId === mine.bookingId)!
    expect(entry.studentKeys.map((k) => k.keyId)).toEqual([mine.device.keyId])
    expect((await api('/api/lab-attendance/roster', mine.session, undefined, 'GET')).status).toBe(403)
    expect(asA.body.expiresAt > asA.body.generatedAt).toBe(true)
  })

  it('gives a pass context only to the booker of an approved booking', async () => {
    const b = await makeBooker('ctx-a')
    const ok = await json(await api(`/api/lab-attendance/bookings/${b.bookingId}/pass`, b.session, undefined, 'GET'))
    expect(ok.status).toBe(200)
    expect(ok.body.booking).toMatchObject({ id: b.bookingId, labId: b.labId })
    const staffKeyIds = (ok.body.staffKeys as { keyId: string }[]).map((k) => k.keyId)
    expect(staffKeyIds).toEqual(expect.arrayContaining([assistantDevice.keyId, headDevice.keyId]))
    expect((await api(`/api/lab-attendance/bookings/${b.bookingId}/pass`, stranger, undefined, 'GET')).status).toBe(404)
    const notApproved = await makeBooker('ctx-b', { status: 'requested' })
    expect((await api(`/api/lab-attendance/bookings/${notApproved.bookingId}/pass`, notApproved.session, undefined, 'GET')).status).toBe(403)
  })
})

describe('time steps', () => {
  it('uses a 30 second step', () => expect(STEP_MS).toBe(30_000))
})
