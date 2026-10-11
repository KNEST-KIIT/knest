import { describe, expect, it } from 'vitest'
import { MAX_BATCH_EVENTS, ROSTER_CACHE_TTL_MS, STEP_MS, UNSYNCED_WARN_MS } from '../constants'
import { toBase64Url } from '../encoding'
import { decideScan } from '../decide'
import { newDevice, TestDirectory } from '../testing'
import { createDeviceKey, ensureDeviceKey, loadDeviceKey } from './device-key'
import { makeLabCode, makePass, scanLabCode, scanStudentPass, type RosterBooking } from './flows'
import { Outbox, type SendBatch } from './outbox'
import { loadRoster, saveRoster } from './roster-cache'
import { MemoryDeviceStore } from './store'

const BOOKING = '11111111-1111-4111-8111-111111111111'
const LAB = '33333333-3333-4333-8333-333333333333'
const START = Date.parse('2026-10-20T10:00:00Z')
const NOW = START + 10 * 60_000

describe('device key', () => {
  it('is created once, registered with a proof, and survives a reload of the store', async () => {
    const store = new MemoryDeviceStore()
    const calls: { publicKey: string; proof: string }[] = []
    const key = await ensureDeviceKey(store, 'u1', async (b) => (calls.push(b), true), 'phone', NOW)
    expect(key.registered).toBe(true)
    expect(calls).toHaveLength(1)
    const again = await ensureDeviceKey(store, 'u1', async () => false, 'phone', NOW)
    expect(again.keyId).toBe(key.keyId)
    expect(calls).toHaveLength(1)
    expect((await loadDeviceKey(store, 'u2'))).toBeNull()
  })

  it('stays unregistered when the server cannot be reached and tries again next time', async () => {
    const store = new MemoryDeviceStore()
    const first = await ensureDeviceKey(store, 'u1', async () => { throw new Error('offline') }, '', NOW)
    expect(first.registered).toBe(false)
    const second = await ensureDeviceKey(store, 'u1', async () => true, '', NOW)
    expect(second.keyId).toBe(first.keyId)
    expect(second.registered).toBe(true)
  })

  it('a device that lost its storage gets a different key and must enrol again', async () => {
    const a = await createDeviceKey(new MemoryDeviceStore(), 'u1')
    const b = await createDeviceKey(new MemoryDeviceStore(), 'u1')
    expect(a.keyId).not.toBe(b.keyId)
  })
})

describe('roster cache', () => {
  it('expires after 24 hours, is private to one user and is wiped when another signs in', async () => {
    const store = new MemoryDeviceStore()
    await saveRoster(store, 'assistant', [{ n: 1 }], NOW)
    expect((await loadRoster(store, 'assistant', NOW + ROSTER_CACHE_TTL_MS - 1))?.entries).toEqual([{ n: 1 }])
    expect(await loadRoster(store, 'assistant', NOW + ROSTER_CACHE_TTL_MS)).toBeNull()
    await saveRoster(store, 'assistant', [{ n: 1 }], NOW)
    expect(await loadRoster(store, 'someone-else', NOW)).toBeNull()
    expect(await loadRoster(store, 'assistant', NOW)).toBeNull() // wiped by the other person's attempt
  })

  it('refuses a cache that claims to be fetched in the future', async () => {
    const store = new MemoryDeviceStore()
    await saveRoster(store, 'a', [], NOW + 60 * 60_000)
    expect(await loadRoster(store, 'a', NOW)).toBeNull()
  })
})

describe('outbox', () => {
  const setup = () => {
    const store = new MemoryDeviceStore()
    let t = NOW
    const outbox = new Outbox(store, 'assistant', () => t)
    return { store, outbox, advance: (ms: number) => (t += ms) }
  }
  const ok: SendBatch = async (b) => ({
    kind: 'ok',
    results: b.events.map(() => ({ id: 'x', status: 'accepted' as const, code: null, check: { action: 'in' as const, state: 'verified' as const } })),
  })

  it('queues idempotently and sends in batches of at most the server limit', async () => {
    const { outbox } = setup()
    for (let i = 0; i < MAX_BATCH_EVENTS + 5; i++) await outbox.enqueue(`id-${i}`, `tok-${i}`)
    await outbox.enqueue('id-0', 'tok-0')
    expect((await outbox.status()).pending).toBe(MAX_BATCH_EVENTS + 5)
    const sizes: number[] = []
    const result = await outbox.flush(async (b) => (sizes.push(b.events.length), ok(b)))
    expect(sizes).toEqual([MAX_BATCH_EVENTS, 5])
    expect(result).toMatchObject({ sent: MAX_BATCH_EVENTS + 5, remaining: 0 })
  })

  it('keeps events when the network fails and never shows them as verified early', async () => {
    const { outbox } = setup()
    await outbox.enqueue('a', 'tok-a')
    const failed = await outbox.flush(async () => { throw new Error('offline') })
    expect(failed).toMatchObject({ sent: 0, remaining: 1 })
    const status = await outbox.status()
    expect(status.pending).toBe(1)
    expect(status.results).toHaveLength(0)
    const retry = await outbox.flush(async () => ({ kind: 'retry', reason: 'server 503' }))
    expect(retry.remaining).toBe(1)
    expect((await outbox.flush(ok)).remaining).toBe(0)
    const done = await outbox.status()
    expect(done.results[0]!.result).toMatchObject({ status: 'accepted', verified: true })
  })

  it('stops and keeps everything when signed out', async () => {
    const { outbox } = setup()
    await outbox.enqueue('a', 'tok-a')
    const r = await outbox.flush(async () => ({ kind: 'signed-out' }))
    expect(r).toMatchObject({ signedOut: true, remaining: 1 })
  })

  it('records a partial result as not verified', async () => {
    const { outbox } = setup()
    await outbox.enqueue('a', 'tok-a')
    await outbox.flush(async () => ({ kind: 'ok', results: [{ id: 'a', status: 'accepted', code: null, check: { action: 'in', state: 'partial' } }] }))
    expect((await outbox.status()).results[0]!.result!.verified).toBe(false)
  })

  it('warns when something has been unsent for more than an hour, and only counts own items', async () => {
    const { store, outbox, advance } = setup()
    await outbox.enqueue('a', 'tok-a')
    await store.put('outbox', 'other', { id: 'other', userId: 'someone', token: 't', createdAt: 0, lastError: null, result: null })
    expect((await outbox.status()).stale).toBe(false)
    advance(UNSYNCED_WARN_MS + 1)
    const s = await outbox.status()
    expect(s.stale).toBe(true)
    expect(s.pending).toBe(1)
  })

  it('clears only answered items', async () => {
    const { outbox } = setup()
    await outbox.enqueue('a', 'tok-a')
    await outbox.enqueue('b', 'tok-b')
    await outbox.flush(async (b) => ({ kind: 'ok' as const, results: [{ id: 'a', status: 'rejected' as const, code: 'expired', check: null }].slice(0, b.events.length) }))
    // the second event had no answer and must stay queued
    await outbox.clearAnswered()
    const s = await outbox.status()
    expect(s.results).toHaveLength(0)
    expect(s.pending).toBe(1)
  })
})

describe('device flows end to end against the server decision', () => {
  async function world() {
    const studentStore = new MemoryDeviceStore()
    const staffStore = new MemoryDeviceStore()
    const student = await createDeviceKey(studentStore, 'student', NOW)
    const staff = await createDeviceKey(staffStore, 'assistant', NOW)
    const dir = new TestDirectory()
    dir.addDevice({ userId: 'student', keyId: student.keyId, privateKey: student.privateKey, publicKey: student.publicKey, publicKeyRaw: new Uint8Array(0) })
    dir.addDevice({ userId: 'assistant', keyId: staff.keyId, privateKey: staff.privateKey, publicKey: staff.publicKey, publicKeyRaw: new Uint8Array(0) })
    dir.addBooking({ id: BOOKING, labId: LAB, userId: 'student', startsAtMs: START, endsAtMs: START + 3_600_000, status: 'approved', assistantUserId: 'assistant' })
    dir.setRole('assistant', LAB, 'assistant')
    const roster: RosterBooking[] = [
      { bookingId: BOOKING, labId: LAB, studentName: 'Asha', studentKeys: [{ keyId: student.keyId, publicKey: student.publicKeyB64 }], startsAt: '', endsAt: '' },
    ]
    return {
      student, staff, dir, roster,
      studentOutbox: new Outbox(studentStore, 'student', () => NOW),
      staffOutbox: new Outbox(staffStore, 'assistant', () => NOW),
    }
  }

  it('a valid pass scanned offline becomes an event the server accepts', async () => {
    const w = await world()
    const pass = await makePass(w.student, BOOKING, 'in', NOW)
    const res = await scanStudentPass({ scanned: pass, roster: w.roster, expectedAction: 'in', device: w.staff, outbox: w.staffOutbox, nowMs: NOW })
    expect(res.ok).toBe(true)
    let sent: string[] = []
    await w.staffOutbox.flush(async (b) => (sent = b.events, { kind: 'retry', reason: 'x' }))
    const decision = await decideScan(sent[0]!, { submitterUserId: 'assistant', serverNowMs: NOW, clientNowMs: NOW }, w.dir)
    expect(decision.status).toBe('accepted')
  })

  it('refuses locally: expired pass, wrong action, foreign booking, forged pass, garbage', async () => {
    const w = await world()
    const old = await makePass(w.student, BOOKING, 'in', NOW - 3 * STEP_MS)
    const base = { roster: w.roster, expectedAction: 'in' as const, device: w.staff, outbox: w.staffOutbox, nowMs: NOW }
    expect(await scanStudentPass({ ...base, scanned: old })).toEqual({ ok: false, problem: 'expired' })
    expect(await scanStudentPass({ ...base, scanned: await makePass(w.student, BOOKING, 'out', NOW) })).toEqual({ ok: false, problem: 'wrong-action' })
    expect(await scanStudentPass({ ...base, scanned: await makePass(w.student, '99999999-9999-4999-8999-999999999999', 'in', NOW) })).toEqual({ ok: false, problem: 'not-on-roster' })
    const impostor = await newDevice('x')
    const wrongKey = { ...w.student, keyId: impostor.keyId }
    expect(await scanStudentPass({ ...base, scanned: await makePass(wrongKey, BOOKING, 'in', NOW) })).toEqual({ ok: false, problem: 'unknown-student-key' })
    // signed by the assistant's own key but claiming the student's key id
    const forged = await makePass({ ...w.staff, keyId: w.student.keyId }, BOOKING, 'in', NOW)
    expect(await scanStudentPass({ ...base, scanned: forged })).toEqual({ ok: false, problem: 'forged' })
    expect(await scanStudentPass({ ...base, scanned: 'hello' })).toEqual({ ok: false, problem: 'not-a-pass' })
    expect((await w.staffOutbox.status()).pending).toBe(0)
  })

  it('a student validates the lab desk code before queueing a scan', async () => {
    const w = await world()
    const staffKeys = [{ keyId: w.staff.keyId, publicKey: w.staff.publicKeyB64 }]
    const base = { booking: { id: BOOKING, labId: LAB }, staffKeys, action: 'in' as const, device: w.student, outbox: w.studentOutbox, nowMs: NOW }
    const code = await makeLabCode(w.staff, LAB, 'in', NOW)
    expect((await scanLabCode({ ...base, scanned: code })).ok).toBe(true)
    expect(await scanLabCode({ ...base, scanned: await makeLabCode(w.staff, LAB, 'out', NOW) })).toEqual({ ok: false, problem: 'wrong-action' })
    expect(await scanLabCode({ ...base, scanned: await makeLabCode(w.staff, '44444444-4444-4444-8444-444444444444', 'in', NOW) })).toEqual({ ok: false, problem: 'wrong-lab' })
    expect(await scanLabCode({ ...base, scanned: await makeLabCode(w.staff, LAB, 'in', NOW - 5 * 60_000) })).toEqual({ ok: false, problem: 'expired' })
    expect(await scanLabCode({ ...base, staffKeys: [], scanned: code })).toEqual({ ok: false, problem: 'forged' })
    expect(await scanLabCode({ ...base, scanned: toBase64Url(new Uint8Array(4)) })).toEqual({ ok: false, problem: 'not-a-code' })
  })
})
