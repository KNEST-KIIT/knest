import { STEP_TOLERANCE, type Action } from '../constants'
import { decodePublicKey, importPublicKeyRaw } from '../keys'
import { createChallenge, createPass, createScanEvent, parseToken, stepWithinTolerance, verifyToken } from '../tokens'
import type { StoredDeviceKey } from './device-key'
import type { Outbox } from './outbox'

/**
 * The two device-side actions of the exchange, and the local checks that give a person an immediate
 * answer instead of a rejection an hour later. These checks are courtesy only: the server verifies
 * everything again and is the one that decides.
 */

export type KeyEntry = { keyId: string; publicKey: string }

async function keyResolver(entries: KeyEntry[]) {
  const map = new Map<string, CryptoKey>()
  for (const e of entries) {
    const raw = decodePublicKey(e.publicKey)
    const key = raw ? await importPublicKeyRaw(raw) : null
    if (key) map.set(e.keyId, key)
  }
  return async (id: string) => map.get(id) ?? null
}

export type StaffScanProblem = 'not-a-pass' | 'not-on-roster' | 'unknown-student-key' | 'forged' | 'expired' | 'wrong-action'

export type RosterBooking = { bookingId: string; labId: string; studentName: string; studentKeys: KeyEntry[]; startsAt: string; endsAt: string }

/**
 * Assistant device: validate a scanned student pass against the cached roster and queue a signed event.
 * Works with no network: the roster carries the public keys it needs.
 */
export async function scanStudentPass(args: {
  scanned: string
  roster: RosterBooking[]
  expectedAction: Action
  device: StoredDeviceKey
  outbox: Outbox
  nowMs: number
  /** True when the device has no connection (or has not reached the server lately). Signed into the event. */
  offline: boolean
  newId?: () => string
}): Promise<{ ok: true; eventId: string; booking: RosterBooking } | { ok: false; problem: StaffScanProblem }> {
  const text = args.scanned.trim()
  const parsed = parseToken(text, 'pass')
  if (!parsed) return { ok: false, problem: 'not-a-pass' }
  const booking = args.roster.find((r) => r.bookingId === parsed.payload.b)
  if (!booking) return { ok: false, problem: 'not-on-roster' }
  if (!booking.studentKeys.some((k) => k.keyId === parsed.payload.k)) return { ok: false, problem: 'unknown-student-key' }
  const verified = await verifyToken(text, 'pass', await keyResolver(booking.studentKeys))
  if (!verified.ok) return { ok: false, problem: 'forged' }
  if (!stepWithinTolerance(parsed.payload.s, args.nowMs, STEP_TOLERANCE)) return { ok: false, problem: 'expired' }
  if (parsed.payload.a !== args.expectedAction) return { ok: false, problem: 'wrong-action' }
  const eventId = (args.newId ?? (() => crypto.randomUUID()))()
  const token = await createScanEvent(
    { id: eventId, side: 'staff', action: args.expectedAction, keyId: args.device.keyId, atMs: args.nowMs, bookingId: booking.bookingId, scanned: text, offline: args.offline },
    args.device.privateKey,
  )
  await args.outbox.enqueue(eventId, token)
  return { ok: true, eventId, booking }
}

export type StudentScanProblem = 'not-a-code' | 'forged' | 'expired' | 'wrong-lab' | 'wrong-action'

/** Student device: validate the lab desk's code against the lab's staff keys and queue a signed event. */
export async function scanLabCode(args: {
  scanned: string
  booking: { id: string; labId: string }
  staffKeys: KeyEntry[]
  action: Action
  device: StoredDeviceKey
  outbox: Outbox
  nowMs: number
  offline: boolean
  newId?: () => string
}): Promise<{ ok: true; eventId: string } | { ok: false; problem: StudentScanProblem }> {
  const text = args.scanned.trim()
  const parsed = parseToken(text, 'chal')
  if (!parsed) return { ok: false, problem: 'not-a-code' }
  if (parsed.payload.l !== args.booking.labId) return { ok: false, problem: 'wrong-lab' }
  const verified = await verifyToken(text, 'chal', await keyResolver(args.staffKeys))
  if (!verified.ok) return { ok: false, problem: 'forged' }
  if (!stepWithinTolerance(parsed.payload.s, args.nowMs, STEP_TOLERANCE)) return { ok: false, problem: 'expired' }
  if (parsed.payload.m !== args.action) return { ok: false, problem: 'wrong-action' }
  const eventId = (args.newId ?? (() => crypto.randomUUID()))()
  const token = await createScanEvent(
    { id: eventId, side: 'student', action: args.action, keyId: args.device.keyId, atMs: args.nowMs, bookingId: args.booking.id, scanned: text, offline: args.offline },
    args.device.privateKey,
  )
  await args.outbox.enqueue(eventId, token)
  return { ok: true, eventId }
}

export const makePass = (device: StoredDeviceKey, bookingId: string, action: Action, nowMs: number) =>
  createPass({ action, bookingId, keyId: device.keyId, nowMs }, device.privateKey)

export const makeLabCode = (device: StoredDeviceKey, labId: string, mode: Action, nowMs: number) =>
  createChallenge({ mode, labId, keyId: device.keyId, nowMs }, device.privateKey)
