import {
  CLIENT_FUTURE_SLOP_MS,
  EARLY_GRACE_MS,
  LATE_GRACE_MS,
  MAX_CLOCK_SKEW_MS,
  MAX_FUTURE_MS,
  MAX_SYNC_DELAY_MS,
  ONLINE_TOLERANCE_MS,
  PAIR_WINDOW_MS,
  STEP_TOLERANCE,
  type Action,
  type Side,
} from './constants'
import { stepWithinTolerance, verifyToken, type ChallengePayload, type PassPayload, type ScanPayload } from './tokens'

/**
 * The server's decision about one scan event. Pure logic over injected lookups, so the whole
 * protocol (forgery, replay, screenshot, clock skew, revocation) is unit-tested without a database
 * and the HTTP layer only supplies DB-backed lookups.
 *
 * The scanning device only ever reports. This function, running on the server, decides.
 */

export type KeyRecord = { userId: string; publicKey: CryptoKey; revokedAtMs: number | null }

export type BookingFacts = {
  id: string
  labId: string
  userId: string
  startsAtMs: number
  endsAtMs: number
  status: string
  assistantUserId: string | null
}

/** What a person is in one lab. `admin` is a lab administrator or super admin. */
export type LabRole = 'admin' | 'head' | 'assistant' | null

export type Lookups = {
  key(keyId: string): Promise<KeyRecord | null>
  booking(bookingId: string): Promise<BookingFacts | null>
  labRole(userId: string, labId: string): Promise<LabRole>
}

export type RejectCode =
  | 'malformed'
  | 'unknown-key'
  | 'bad-signature'
  | 'key-revoked'
  | 'not-your-key'
  | 'booking-not-found'
  | 'booking-not-attendable'
  | 'wrong-booking'
  | 'wrong-lab'
  | 'wrong-action'
  | 'not-staff'
  | 'not-assigned'
  | 'not-the-booker'
  | 'expired'
  | 'outside-slot'

export type ReviewCode = 'clock-skew' | 'late-sync' | 'future-dated' | 'key-revoked-before-sync' | 'booking-state'

export type Accepted = {
  status: 'accepted'
  side: Side
  action: Action
  bookingId: string
  labId: string
  /** Scan time on the server's timeline, after correcting the scanner's clock by its measured skew. */
  effectiveAtMs: number
  scannerUserId: string
  /** The signer of the scanned token: the student's key for a pass, the assistant's for a challenge. */
  innerKeyId: string
  innerUserId: string
  innerNonce: string
  innerStep: number
}
export type Rejected = { status: 'rejected'; code: RejectCode }
export type NeedsReview = { status: 'review'; code: ReviewCode; detail: Omit<Accepted, 'status'> }
export type Decision = Accepted | Rejected | NeedsReview

export type Context = {
  /** The signed-in user who is submitting. Must own the scanner key. */
  submitterUserId: string
  serverNowMs: number
  /** The submitting device's clock when it sent the batch (unsigned; used only to measure skew). */
  clientNowMs: number
}

const reject = (code: RejectCode): Rejected => ({ status: 'rejected', code })

/** Booking states a scan may count against. `no_show` is a head decision a late scan must not silently undo. */
const ATTENDABLE = new Set(['approved', 'completed'])

export async function decideScan(token: string, ctx: Context, lookups: Lookups): Promise<Decision> {
  // 1. The envelope: signed by a registered, current key that belongs to the person submitting it.
  const keyCache = new Map<string, KeyRecord | null>()
  const resolveRecord = async (id: string) => {
    if (!keyCache.has(id)) keyCache.set(id, await lookups.key(id))
    return keyCache.get(id) ?? null
  }
  const resolvePublic = async (id: string) => (await resolveRecord(id))?.publicKey ?? null

  const envelope = await verifyToken(token, 'scan', resolvePublic)
  if (!envelope.ok) return reject(envelope.code)
  const event: ScanPayload = envelope.payload
  const scannerKey = (await resolveRecord(event.k))!
  if (scannerKey.userId !== ctx.submitterUserId) return reject('not-your-key')

  // 2. The scanned token: signed by a registered key, of the type this side must have scanned.
  let inner: PassPayload | ChallengePayload
  if (event.sd === 'staff') {
    const v = await verifyToken(event.tok, 'pass', resolvePublic)
    if (!v.ok) return reject(v.code)
    inner = v.payload
  } else {
    const v = await verifyToken(event.tok, 'chal', resolvePublic)
    if (!v.ok) return reject(v.code)
    inner = v.payload
  }
  const innerKey = (await resolveRecord(inner.k))!

  // 3. Booking, people and lab all have to agree.
  const booking = await lookups.booking(event.bk)
  if (!booking) return reject('booking-not-found')

  if (event.sd === 'staff') {
    const pass = inner as PassPayload
    if (pass.b !== booking.id) return reject('wrong-booking')
    if (pass.a !== event.a) return reject('wrong-action')
    if (innerKey.userId !== booking.userId) return reject('not-the-booker')
    const role = await lookups.labRole(scannerKey.userId, booking.labId)
    if (!role) return reject('not-staff')
    if (role === 'assistant' && booking.assistantUserId !== null && booking.assistantUserId !== scannerKey.userId) return reject('not-assigned')
  } else {
    const chal = inner as ChallengePayload
    if (chal.l !== booking.labId) return reject('wrong-lab')
    if (chal.m !== event.a) return reject('wrong-action')
    if (scannerKey.userId !== booking.userId) return reject('not-the-booker')
    const role = await lookups.labRole(innerKey.userId, booking.labId)
    if (!role) return reject('not-staff')
    if (role === 'assistant' && booking.assistantUserId !== null && booking.assistantUserId !== innerKey.userId) return reject('not-assigned')
  }

  // 4. Time. The scanner's own clock is corrected by the skew measured at this submission.
  // The batch time is unsigned and chosen by the submitter, so it only ever corrects an event the
  // device itself signed as created offline. An online event is judged against the server's clock.
  const offline = event.ol === 1
  const skewMs = offline ? ctx.clientNowMs - ctx.serverNowMs : event.at - ctx.serverNowMs
  const effectiveAtMs = offline ? event.at - skewMs : event.at

  // A pass or challenge is only valid in its own time step (screenshot defence, T1).
  if (!stepWithinTolerance(inner.s, effectiveAtMs, STEP_TOLERANCE)) return reject('expired')

  // 5. The slot.
  if (effectiveAtMs < booking.startsAtMs - EARLY_GRACE_MS || effectiveAtMs > booking.endsAtMs + LATE_GRACE_MS) return reject('outside-slot')

  // 6. Revocation (T14). Revoked at or before the scan: refused. Scanned before it but only arriving
  // now: a person decides, because a thief can also claim an old time.
  const detail: Omit<Accepted, 'status'> = {
    side: event.sd,
    action: event.a,
    bookingId: booking.id,
    labId: booking.labId,
    effectiveAtMs,
    scannerUserId: scannerKey.userId,
    innerKeyId: inner.k,
    innerUserId: innerKey.userId,
    innerNonce: inner.n,
    innerStep: inner.s,
  }
  let revokedBeforeSync = false
  for (const record of [scannerKey, innerKey]) {
    if (record.revokedAtMs !== null) {
      if (effectiveAtMs >= record.revokedAtMs) return reject('key-revoked')
      revokedBeforeSync = true
    }
  }

  if (!ATTENDABLE.has(booking.status)) {
    // Cancelled, rejected, requested or proposed bookings are not attendable at all.
    return booking.status === 'no_show' ? { status: 'review', code: 'booking-state', detail } : reject('booking-not-attendable')
  }

  // 7. Everything that is believable but should be seen by a person.
  if (revokedBeforeSync) return { status: 'review', code: 'key-revoked-before-sync', detail }
  if (offline ? Math.abs(skewMs) > MAX_CLOCK_SKEW_MS : Math.abs(skewMs) > ONLINE_TOLERANCE_MS) return { status: 'review', code: 'clock-skew', detail }
  if (offline && event.at - ctx.clientNowMs > CLIENT_FUTURE_SLOP_MS) return { status: 'review', code: 'future-dated', detail }
  if (ctx.serverNowMs - effectiveAtMs > MAX_SYNC_DELAY_MS) return { status: 'review', code: 'late-sync', detail }
  if (effectiveAtMs - ctx.serverNowMs > MAX_FUTURE_MS) return { status: 'review', code: 'future-dated', detail }

  return { status: 'accepted', ...detail }
}

// ---- pairing --------------------------------------------------------------------------------

export type PairEvent = { side: Side; effectiveAtMs: number }
export type PairState = 'none' | 'partial-staff' | 'partial-student' | 'verified'

/** The earliest staff and student events that sit within the pair window of each other, if any. */
export function pickPair<T extends PairEvent>(events: T[]): { staff: T; student: T } | null {
  const sorted = [...events].sort((a, b) => a.effectiveAtMs - b.effectiveAtMs)
  for (const staff of sorted.filter((e) => e.side === 'staff')) {
    for (const student of sorted.filter((e) => e.side === 'student')) {
      if (Math.abs(staff.effectiveAtMs - student.effectiveAtMs) <= PAIR_WINDOW_MS) return { staff, student }
    }
  }
  return null
}

/**
 * Whether the accepted events of one booking and action make a verified check. "Verified" needs both
 * directions inside PAIR_WINDOW_MS of each other. One direction is only "partially recorded".
 */
export function pairState(events: PairEvent[]): PairState {
  const staff = events.filter((e) => e.side === 'staff')
  const student = events.filter((e) => e.side === 'student')
  for (const a of staff) for (const b of student) if (Math.abs(a.effectiveAtMs - b.effectiveAtMs) <= PAIR_WINDOW_MS) return 'verified'
  if (staff.length > 0) return 'partial-staff'
  if (student.length > 0) return 'partial-student'
  return 'none'
}
