import { describe, expect, it } from 'vitest'
import { STEP_MS, MAX_CLOCK_SKEW_MS, MAX_SYNC_DELAY_MS, PAIR_WINDOW_MS, TOKEN_PREFIX } from './constants'
import { decideScan, pairState, type Context } from './decide'
import { fromBase64Url, toBase64Url, utf8 } from './encoding'
import { importPublicKeyRaw, keyIdFor } from './keys'
import { newDevice, TestDirectory, type TestDevice } from './testing'
import {
  createChallenge,
  createPass,
  createRegistrationProof,
  createScanEvent,
  createToken,
  parseToken,
  verifyToken,
} from './tokens'

const BOOKING = '11111111-1111-4111-8111-111111111111'
const OTHER_BOOKING = '22222222-2222-4222-8222-222222222222'
const LAB = '33333333-3333-4333-8333-333333333333'
const OTHER_LAB = '44444444-4444-4444-8444-444444444444'
const uuid = () => crypto.randomUUID()

const START = Date.parse('2026-10-20T10:00:00Z')
const END = START + 60 * 60 * 1000
const NOW = START + 10 * 60 * 1000

async function world() {
  const student = await newDevice('student')
  const assistant = await newDevice('assistant')
  const otherAssistant = await newDevice('other-assistant')
  const head = await newDevice('head')
  const outsider = await newDevice('outsider')
  const dir = new TestDirectory()
  for (const d of [student, assistant, otherAssistant, head, outsider]) dir.addDevice(d)
  dir.addBooking({ id: BOOKING, labId: LAB, userId: 'student', startsAtMs: START, endsAtMs: END, status: 'approved', assistantUserId: 'assistant' })
  dir.setRole('assistant', LAB, 'assistant')
  dir.setRole('other-assistant', LAB, 'assistant')
  dir.setRole('head', LAB, 'head')
  return { student, assistant, otherAssistant, head, outsider, dir }
}

const ctx = (userId: string, over: Partial<Context> = {}): Context => ({ submitterUserId: userId, serverNowMs: NOW, clientNowMs: NOW, ...over })

async function staffScan(scanner: TestDevice, student: TestDevice, at = NOW, over: { passAt?: number; action?: 'in' | 'out'; booking?: string } = {}) {
  const pass = await createPass({ action: over.action ?? 'in', bookingId: over.booking ?? BOOKING, keyId: student.keyId, nowMs: over.passAt ?? at }, student.privateKey)
  return createScanEvent(
    { id: uuid(), side: 'staff', action: 'in', keyId: scanner.keyId, atMs: at, bookingId: BOOKING, scanned: pass },
    scanner.privateKey,
  )
}

async function studentScan(student: TestDevice, assistant: TestDevice, at = NOW, over: { labId?: string; mode?: 'in' | 'out' } = {}) {
  const chal = await createChallenge({ mode: over.mode ?? 'in', labId: over.labId ?? LAB, keyId: assistant.keyId, nowMs: at }, assistant.privateKey)
  return createScanEvent({ id: uuid(), side: 'student', action: 'in', keyId: student.keyId, atMs: at, bookingId: BOOKING, scanned: chal }, student.privateKey)
}

describe('encoding and keys', () => {
  it('round-trips base64url and rejects non-canonical text', () => {
    for (const len of [0, 1, 2, 3, 4, 31, 64, 65]) {
      const bytes = crypto.getRandomValues(new Uint8Array(len))
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
    }
    expect(fromBase64Url('AB=')).toBeNull()
    expect(fromBase64Url('A')).toBeNull()
    expect(fromBase64Url('AB')).toBeNull() // stray low bits: 'AB' is not the canonical form of one byte
    expect(fromBase64Url('a+b/')).toBeNull()
  })

  it('generates non-extractable private keys and a deterministic key id', async () => {
    const d = await newDevice('u')
    await expect(crypto.subtle.exportKey('pkcs8', d.privateKey)).rejects.toThrow()
    await expect(crypto.subtle.exportKey('jwk', d.privateKey)).rejects.toThrow()
    expect(d.privateKey.extractable).toBe(false)
    expect(d.publicKeyRaw).toHaveLength(65)
    expect(await keyIdFor(d.publicKeyRaw)).toBe(d.keyId)
    expect(d.keyId).toMatch(/^[A-Za-z0-9_-]{16}$/)
  })

  it('refuses malformed or off-curve public keys', async () => {
    expect(await importPublicKeyRaw(new Uint8Array(65))).toBeNull()
    expect(await importPublicKeyRaw(new Uint8Array(10))).toBeNull()
    const offCurve = new Uint8Array(65).fill(7)
    offCurve[0] = 4
    expect(await importPublicKeyRaw(offCurve)).toBeNull()
  })
})

describe('tokens', () => {
  it('round-trips a pass and keeps personal data out of the payload', async () => {
    const { student, dir } = await world()
    const token = await createPass({ action: 'in', bookingId: BOOKING, keyId: student.keyId, nowMs: NOW }, student.privateKey)
    expect(token.startsWith(`${TOKEN_PREFIX}.`)).toBe(true)
    expect(token.length).toBeLessThan(400)
    const result = await verifyToken(token, 'pass', async (id) => (await dir.key(id))?.publicKey ?? null)
    expect(result.ok).toBe(true)
    const body = new TextDecoder().decode(fromBase64Url(token.split('.')[1]!)!)
    expect(body).not.toMatch(/student|@/)
  })

  it('rejects a tampered payload and a tampered signature', async () => {
    const { student, dir } = await world()
    const resolve = async (id: string) => (await dir.key(id))?.publicKey ?? null
    const token = await createPass({ action: 'in', bookingId: BOOKING, keyId: student.keyId, nowMs: NOW }, student.privateKey)
    const [p, payload, sig] = token.split('.') as [string, string, string]
    const swapped = toBase64Url(utf8(new TextDecoder().decode(fromBase64Url(payload)!).replace(BOOKING, OTHER_BOOKING)))
    expect(await verifyToken(`${p}.${swapped}.${sig}`, 'pass', resolve)).toEqual({ ok: false, code: 'bad-signature' })
    const flipped = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA')
    expect(await verifyToken(`${p}.${payload}.${flipped}`, 'pass', resolve)).toMatchObject({ ok: false })
  })

  it('does not let one message type pass for another (domain separation)', async () => {
    const { student, assistant, dir } = await world()
    const resolve = async (id: string) => (await dir.key(id))?.publicKey ?? null
    const pass = await createPass({ action: 'in', bookingId: BOOKING, keyId: student.keyId, nowMs: NOW }, student.privateKey)
    expect(await verifyToken(pass, 'chal', resolve)).toEqual({ ok: false, code: 'malformed' })
    expect(await verifyToken(pass, 'scan', resolve)).toEqual({ ok: false, code: 'malformed' })
    // A payload relabelled as another type but signed under the old domain does not verify.
    const chal = await createChallenge({ mode: 'in', labId: LAB, keyId: assistant.keyId, nowMs: NOW }, assistant.privateKey)
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(chal.split('.')[1]!)!))
    const forged = await createToken<'chal'>({ ...payload, t: 'chal' }, assistant.privateKey)
    expect((await verifyToken(forged, 'chal', resolve)).ok).toBe(true)
    const reg = await createRegistrationProof({ userId: 'student', keyId: student.keyId, nowMs: NOW }, student.privateKey)
    expect(await verifyToken(reg, 'pass', resolve)).toEqual({ ok: false, code: 'malformed' })
  })

  it('rejects malformed, oversized and over-fielded tokens', async () => {
    const { student } = await world()
    for (const bad of ['', 'K1', 'K1..', 'K2.AA.AA', 'K1.@@.@@', 'x'.repeat(5000), 'K1.' + toBase64Url(utf8('[]')) + '.' + toBase64Url(new Uint8Array(64))]) {
      expect(parseToken(bad, 'pass')).toBeNull()
    }
    const extra = await createToken<'pass'>({ v: 1, t: 'pass', a: 'in', b: BOOKING, k: student.keyId, s: 5, n: 'AAAAAAAAAAAAAAAA', x: 1 } as never, student.privateKey)
    expect(parseToken(extra, 'pass')).toBeNull()
    const badAction = await createToken<'pass'>({ v: 1, t: 'pass', a: 'sideways', b: BOOKING, k: student.keyId, s: 5, n: 'AAAAAAAAAAAAAAAA' } as never, student.privateKey)
    expect(parseToken(badAction, 'pass')).toBeNull()
  })

  it('reports an unregistered key as unknown', async () => {
    const { outsider } = await world()
    const token = await createPass({ action: 'in', bookingId: BOOKING, keyId: outsider.keyId, nowMs: NOW }, outsider.privateKey)
    expect(await verifyToken(token, 'pass', async () => null)).toEqual({ ok: false, code: 'unknown-key' })
  })
})

describe('decideScan: acceptance', () => {
  it('accepts a staff scan of a valid pass by the assigned assistant', async () => {
    const w = await world()
    const d = await decideScan(await staffScan(w.assistant, w.student), ctx('assistant'), w.dir)
    expect(d).toMatchObject({ status: 'accepted', side: 'staff', action: 'in', bookingId: BOOKING, innerUserId: 'student' })
  })

  it('accepts the student side scanning the lab desk challenge', async () => {
    const w = await world()
    const d = await decideScan(await studentScan(w.student, w.assistant), ctx('student'), w.dir)
    expect(d).toMatchObject({ status: 'accepted', side: 'student', innerUserId: 'assistant' })
  })

  it('lets a head and an unassigned booking use any lab assistant', async () => {
    const w = await world()
    expect((await decideScan(await staffScan(w.head, w.student), ctx('head'), w.dir)).status).toBe('accepted')
    w.dir.addBooking({ ...(await w.dir.booking(BOOKING))!, assistantUserId: null })
    expect((await decideScan(await staffScan(w.otherAssistant, w.student), ctx('other-assistant'), w.dir)).status).toBe('accepted')
  })

  it('tolerates one step of drift either way and nothing more', async () => {
    const w = await world()
    for (const drift of [-STEP_MS, 0, STEP_MS]) {
      expect((await decideScan(await staffScan(w.assistant, w.student, NOW, { passAt: NOW + drift }), ctx('assistant'), w.dir)).status).toBe('accepted')
    }
    expect(await decideScan(await staffScan(w.assistant, w.student, NOW, { passAt: NOW - 2 * STEP_MS }), ctx('assistant'), w.dir)).toEqual({ status: 'rejected', code: 'expired' })
  })
})

describe('decideScan: forgery', () => {
  it('rejects an event signed by a key nobody registered', async () => {
    const w = await world()
    const rogue = await newDevice('assistant')
    const d = await decideScan(await staffScan(rogue, w.student), ctx('assistant'), w.dir)
    expect(d).toEqual({ status: 'rejected', code: 'unknown-key' })
  })

  it('rejects an event that claims a registered key id but is signed by another key', async () => {
    const w = await world()
    const rogue = await newDevice('assistant')
    const pass = await createPass({ action: 'in', bookingId: BOOKING, keyId: w.student.keyId, nowMs: NOW }, w.student.privateKey)
    const token = await createScanEvent(
      { id: uuid(), side: 'staff', action: 'in', keyId: w.assistant.keyId, atMs: NOW, bookingId: BOOKING, scanned: pass },
      rogue.privateKey,
    )
    expect(await decideScan(token, ctx('assistant'), w.dir)).toEqual({ status: 'rejected', code: 'bad-signature' })
  })

  it('rejects a pass forged by an assistant who holds only their own key', async () => {
    const w = await world()
    // The assistant signs a "student pass" naming the student's key id with their own private key.
    const forgedPass = await createPass({ action: 'in', bookingId: BOOKING, keyId: w.student.keyId, nowMs: NOW }, w.assistant.privateKey)
    const token = await createScanEvent(
      { id: uuid(), side: 'staff', action: 'in', keyId: w.assistant.keyId, atMs: NOW, bookingId: BOOKING, scanned: forgedPass },
      w.assistant.privateKey,
    )
    expect(await decideScan(token, ctx('assistant'), w.dir)).toEqual({ status: 'rejected', code: 'bad-signature' })
  })

  it('rejects a pass of a different student presented for this booking', async () => {
    const w = await world()
    const friend = await newDevice('friend')
    w.dir.addDevice(friend)
    const d = await decideScan(await staffScan(w.assistant, friend), ctx('assistant'), w.dir)
    expect(d).toEqual({ status: 'rejected', code: 'not-the-booker' })
  })

  it('rejects a pass for another booking', async () => {
    const w = await world()
    const d = await decideScan(await staffScan(w.assistant, w.student, NOW, { booking: OTHER_BOOKING }), ctx('assistant'), w.dir)
    expect(d).toEqual({ status: 'rejected', code: 'wrong-booking' })
  })

  it('rejects an action that differs from the pass', async () => {
    const w = await world()
    const d = await decideScan(await staffScan(w.assistant, w.student, NOW, { action: 'out' }), ctx('assistant'), w.dir)
    expect(d).toEqual({ status: 'rejected', code: 'wrong-action' })
  })

  it('rejects a scanner who is not staff of the lab, and an unassigned assistant', async () => {
    const w = await world()
    expect(await decideScan(await staffScan(w.outsider, w.student), ctx('outsider'), w.dir)).toEqual({ status: 'rejected', code: 'not-staff' })
    expect(await decideScan(await staffScan(w.otherAssistant, w.student), ctx('other-assistant'), w.dir)).toEqual({ status: 'rejected', code: 'not-assigned' })
  })

  it('rejects a student-side scan of a challenge from a non-staff key or another lab', async () => {
    const w = await world()
    expect(await decideScan(await studentScan(w.student, w.outsider), ctx('student'), w.dir)).toEqual({ status: 'rejected', code: 'not-staff' })
    expect(await decideScan(await studentScan(w.student, w.assistant, NOW, { labId: OTHER_LAB }), ctx('student'), w.dir)).toEqual({ status: 'rejected', code: 'wrong-lab' })
    expect(await decideScan(await studentScan(w.student, w.assistant, NOW, { mode: 'out' }), ctx('student'), w.dir)).toEqual({ status: 'rejected', code: 'wrong-action' })
  })

  it('rejects a student-side scan made by someone who is not the booker', async () => {
    const w = await world()
    const friend = await newDevice('friend')
    w.dir.addDevice(friend)
    expect(await decideScan(await studentScan(friend, w.assistant), ctx('friend'), w.dir)).toEqual({ status: 'rejected', code: 'not-the-booker' })
  })
})

describe('decideScan: replay, screenshot and relay', () => {
  it('rejects a captured scan event submitted from another account or device', async () => {
    const w = await world()
    const event = await staffScan(w.assistant, w.student)
    expect(await decideScan(event, ctx('other-assistant'), w.dir)).toEqual({ status: 'rejected', code: 'not-your-key' })
    expect(await decideScan(event, ctx('student'), w.dir)).toEqual({ status: 'rejected', code: 'not-your-key' })
  })

  it('rejects a photographed pass shown after the step window', async () => {
    const w = await world()
    const pass = await createPass({ action: 'in', bookingId: BOOKING, keyId: w.student.keyId, nowMs: NOW }, w.student.privateKey)
    for (const delay of [90_000, 5 * 60_000]) {
      const at = NOW + delay
      const event = await createScanEvent({ id: uuid(), side: 'staff', action: 'in', keyId: w.assistant.keyId, atMs: at, bookingId: BOOKING, scanned: pass }, w.assistant.privateKey)
      expect(await decideScan(event, ctx('assistant', { serverNowMs: at, clientNowMs: at }), w.dir)).toEqual({ status: 'rejected', code: 'expired' })
    }
    // 30 s later is still inside the one-step tolerance: the code is valid for that long, not longer.
    const event = await createScanEvent({ id: uuid(), side: 'staff', action: 'in', keyId: w.assistant.keyId, atMs: NOW + 30_000, bookingId: BOOKING, scanned: pass }, w.assistant.privateKey)
    expect((await decideScan(event, ctx('assistant', { serverNowMs: NOW + 30_000, clientNowMs: NOW + 30_000 }), w.dir)).status).toBe('accepted')
  })

  it('does not accept an assistant who back-dates the scan time against the server clock', async () => {
    const w = await world()
    // A pass from 10 minutes ago, scan time claimed as 10 minutes ago, submitted now with an honest
    // client clock: the claimed elapsed time is the whole 10 minutes, still within slot, but the
    // pass step then matches the claimed time. Back-dating is bounded by the slot and the 24 h rule.
    const old = NOW - 10 * 60_000
    const d = await decideScan(await staffScan(w.assistant, w.student, old), ctx('assistant'), w.dir)
    expect(d.status).toBe('accepted')
    // Back-dated beyond the slot is refused.
    const way = START - 2 * 60 * 60_000
    expect(await decideScan(await staffScan(w.assistant, w.student, way), ctx('assistant'), w.dir)).toEqual({ status: 'rejected', code: 'outside-slot' })
  })

  it('refuses a scan outside the slot window and for a booking that cannot be attended', async () => {
    const w = await world()
    const late = END + 40 * 60_000
    expect(await decideScan(await staffScan(w.assistant, w.student, late), ctx('assistant', { serverNowMs: late, clientNowMs: late }), w.dir)).toEqual({ status: 'rejected', code: 'outside-slot' })
    for (const status of ['requested', 'cancelled', 'rejected', 'alternative_proposed']) {
      w.dir.addBooking({ ...(await w.dir.booking(BOOKING))!, status })
      expect(await decideScan(await staffScan(w.assistant, w.student), ctx('assistant'), w.dir)).toEqual({ status: 'rejected', code: 'booking-not-attendable' })
    }
  })

  it('sends a scan for a booking already marked no-show to review', async () => {
    const w = await world()
    w.dir.addBooking({ ...(await w.dir.booking(BOOKING))!, status: 'no_show' })
    const d = await decideScan(await staffScan(w.assistant, w.student), ctx('assistant'), w.dir)
    expect(d).toMatchObject({ status: 'review', code: 'booking-state' })
  })
})

describe('decideScan: clock skew', () => {
  it('sends a scanner whose clock is far off to review, and corrects for the skew', async () => {
    const w = await world()
    // The scanner phone runs one hour fast. Its pass came from a correct student phone.
    const skew = 60 * 60_000
    const event = await createScanEvent(
      { id: uuid(), side: 'staff', action: 'in', keyId: w.assistant.keyId, atMs: NOW + skew, bookingId: BOOKING, scanned: await createPass({ action: 'in', bookingId: BOOKING, keyId: w.student.keyId, nowMs: NOW }, w.student.privateKey) },
      w.assistant.privateKey,
    )
    const d = await decideScan(event, ctx('assistant', { clientNowMs: NOW + skew }), w.dir)
    expect(d).toMatchObject({ status: 'review', code: 'clock-skew' })
    if (d.status === 'review') expect(d.detail.effectiveAtMs).toBe(NOW)
  })

  it('treats exactly the tolerance as acceptable and one millisecond more as review', async () => {
    const w = await world()
    for (const [skew, expected] of [[MAX_CLOCK_SKEW_MS, 'accepted'], [MAX_CLOCK_SKEW_MS + 1, 'review']] as const) {
      const pass = await createPass({ action: 'in', bookingId: BOOKING, keyId: w.student.keyId, nowMs: NOW }, w.student.privateKey)
      const event = await createScanEvent({ id: uuid(), side: 'staff', action: 'in', keyId: w.assistant.keyId, atMs: NOW + skew, bookingId: BOOKING, scanned: pass }, w.assistant.privateKey)
      expect((await decideScan(event, ctx('assistant', { clientNowMs: NOW + skew }), w.dir)).status).toBe(expected)
    }
  })

  it('sends an event that syncs more than 24 hours late to review', async () => {
    const w = await world()
    const event = await staffScan(w.assistant, w.student, NOW)
    const later = NOW + MAX_SYNC_DELAY_MS + 60_000
    const d = await decideScan(event, ctx('assistant', { serverNowMs: later, clientNowMs: later }), w.dir)
    expect(d).toMatchObject({ status: 'review', code: 'late-sync' })
  })

  it('sends a scan dated in the future to review', async () => {
    const w = await world()
    // The device claims the scan happened three minutes after the server time it reports for itself.
    const future = NOW + 3 * 60_000
    const event = await staffScan(w.assistant, w.student, future)
    const d = await decideScan(event, ctx('assistant', { clientNowMs: NOW }), w.dir)
    expect(d).toMatchObject({ status: 'review', code: 'future-dated' })
  })
})

describe('decideScan: key revocation', () => {
  it('refuses scans from a key revoked at or before the scan', async () => {
    const w = await world()
    w.dir.revoke(w.student.keyId, NOW - 1000)
    expect(await decideScan(await staffScan(w.assistant, w.student), ctx('assistant'), w.dir)).toEqual({ status: 'rejected', code: 'key-revoked' })
    w.dir.addDevice(w.student)
    w.dir.revoke(w.assistant.keyId, NOW)
    expect(await decideScan(await staffScan(w.assistant, w.student), ctx('assistant'), w.dir)).toEqual({ status: 'rejected', code: 'key-revoked' })
  })

  it('sends an event from before the revocation, arriving after it, to review', async () => {
    const w = await world()
    const event = await staffScan(w.assistant, w.student, NOW)
    w.dir.revoke(w.assistant.keyId, NOW + 5 * 60_000)
    const d = await decideScan(event, ctx('assistant', { serverNowMs: NOW + 10 * 60_000, clientNowMs: NOW + 10 * 60_000 }), w.dir)
    expect(d).toMatchObject({ status: 'review', code: 'key-revoked-before-sync' })
  })
})

describe('registration proof', () => {
  it('is a verifiable token that binds a key to a user and a moment', async () => {
    const d = await newDevice('u1')
    const proof = await createRegistrationProof({ userId: 'u1', keyId: d.keyId, nowMs: NOW }, d.privateKey)
    const parsed = await verifyToken(proof, 'reg', async () => d.publicKey)
    expect(parsed).toMatchObject({ ok: true, payload: { u: 'u1', k: d.keyId, at: NOW } })
    const wrong = await newDevice('u2')
    expect(await verifyToken(proof, 'reg', async () => wrong.publicKey)).toEqual({ ok: false, code: 'bad-signature' })
  })
})

describe('pairState', () => {
  it('needs both directions inside the pair window', () => {
    expect(pairState([])).toBe('none')
    expect(pairState([{ side: 'staff', effectiveAtMs: 0 }])).toBe('partial-staff')
    expect(pairState([{ side: 'student', effectiveAtMs: 0 }])).toBe('partial-student')
    expect(pairState([{ side: 'staff', effectiveAtMs: 0 }, { side: 'student', effectiveAtMs: PAIR_WINDOW_MS }])).toBe('verified')
    expect(pairState([{ side: 'staff', effectiveAtMs: 0 }, { side: 'student', effectiveAtMs: PAIR_WINDOW_MS + 1 }])).toBe('partial-staff')
    expect(pairState([{ side: 'staff', effectiveAtMs: 0 }, { side: 'staff', effectiveAtMs: 10 }])).toBe('partial-staff')
  })
})
