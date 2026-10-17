import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLogs, labAttendance, labBookings, labDeviceKeys, labQrChecks, labScanEvents, labStaff, labs, users } from '@/db/schema'
import { MAX_BATCH_EVENTS, MAX_CLOCK_SKEW_MS, ROSTER_CACHE_TTL_MS, type Action } from '@/lib/lab-qr/constants'
import { decideScan, pickPair, type BookingFacts, type Decision, type KeyRecord, type LabRole, type Lookups } from '@/lib/lab-qr/decide'
import { decodePublicKey, importPublicKeyRaw, keyIdFor } from '@/lib/lab-qr/keys'
import { parseToken, verifyToken } from '@/lib/lab-qr/tokens'
import { requireUserOrThrow } from '@/server/auth/guards'
import { actorFor, canManage, isLabAdmin, requireManager } from './access'
import type { StaffRole } from '@/server/auth/roles'

/**
 * Server side of QR attendance (modules 30 and 31). The protocol lives in `src/lib/lab-qr`; this file
 * is the database around it: key registration and revocation, the roster a scanning device may cache,
 * the idempotent scan intake that decides and pairs, and the head's review queue.
 *
 * Assurance level is RECORD ATTENDANCE. The server decides; a device only reports.
 */

export type QrCode = 'closed' | 'invalid' | 'not-found' | 'forbidden' | 'conflict' | 'limit'
export type QrResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; code: QrCode }
const fail = (error: string, code: QrCode): { ok: false; error: string; code: QrCode } => ({ ok: false, error, code })

const MAX_ACTIVE_KEYS = 5

// ---------------------------------------------------------------------------------- keys

export type DeviceKeyInfo = { id: string; label: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }

const keyInfo = (row: typeof labDeviceKeys.$inferSelect): DeviceKeyInfo => ({
  id: row.id,
  label: row.label,
  createdAt: row.createdAt.toISOString(),
  lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  revokedAt: row.revokedAt?.toISOString() ?? null,
})

/**
 * Registers the public half of a device key for the signed-in person. The caller proves it holds the
 * private half by signing a registration token naming the user and the key, so nobody can register
 * someone else's public key under their own account, and a replayed proof is harmless (idempotent).
 */
export async function registerDeviceKey(
  input: { publicKey: unknown; proof: unknown; label?: unknown },
  now = new Date(),
): Promise<QrResult<{ key: DeviceKeyInfo }>> {
  const user = await requireUserOrThrow()
  if (typeof input.publicKey !== 'string' || typeof input.proof !== 'string') return fail('Send the public key and its proof.', 'invalid')
  const raw = decodePublicKey(input.publicKey)
  if (!raw) return fail('That is not a valid device key.', 'invalid')
  const imported = await importPublicKeyRaw(raw)
  if (!imported) return fail('That is not a valid device key.', 'invalid')
  const keyId = await keyIdFor(raw)

  const proof = await verifyToken(input.proof, 'reg', async (id) => (id === keyId ? imported : null))
  if (!proof.ok) return fail('The key proof did not verify.', 'invalid')
  if (proof.payload.u !== user.id) return fail('The key proof was made for another account.', 'forbidden')
  if (Math.abs(now.getTime() - proof.payload.at) > MAX_CLOCK_SKEW_MS) return fail('Your device clock is more than five minutes off. Fix the time and try again.', 'invalid')

  const label = typeof input.label === 'string' ? input.label.trim().slice(0, 60) : ''
  const existing = await db.query.labDeviceKeys.findFirst({ where: eq(labDeviceKeys.id, keyId) })
  if (existing) {
    if (existing.userId !== user.id) return fail('That key is already registered.', 'conflict')
    if (existing.revokedAt) return fail('That key was revoked. Generate a new one on this device.', 'forbidden')
    return { ok: true, key: keyInfo(existing) }
  }
  const active = await db.query.labDeviceKeys.findMany({ where: and(eq(labDeviceKeys.userId, user.id), isNull(labDeviceKeys.revokedAt)), columns: { id: true } })
  if (active.length >= MAX_ACTIVE_KEYS) return fail('You have too many registered devices. Revoke one you no longer use.', 'limit')

  const [row] = await db
    .insert(labDeviceKeys)
    .values({ id: keyId, userId: user.id, publicKey: input.publicKey, label })
    .onConflictDoNothing()
    .returning()
  if (!row) return fail('That key is already registered.', 'conflict')
  await db.insert(auditLogs).values({ actorUserId: user.id, action: 'lab_device_key_registered', entityType: 'lab_device_key', entityId: keyId, before: null, after: { label } })
  return { ok: true, key: keyInfo(row) }
}

export async function listMyDeviceKeys(): Promise<DeviceKeyInfo[]> {
  const user = await requireUserOrThrow()
  const rows = await db.select().from(labDeviceKeys).where(eq(labDeviceKeys.userId, user.id)).orderBy(desc(labDeviceKeys.createdAt))
  return rows.map(keyInfo)
}

/**
 * Revokes a key. The owner may revoke their own; a lab administrator may revoke any; the head of a lab
 * may revoke the key of a person who has a booking in that lab (lost phone, T14). A revoked key's
 * scans are refused from the revocation time on, and earlier ones that arrive late go to review.
 */
export async function revokeDeviceKey(keyId: string, reason: unknown, now = new Date()): Promise<QrResult> {
  const user = await requireUserOrThrow()
  const key = await db.query.labDeviceKeys.findFirst({ where: eq(labDeviceKeys.id, keyId) })
  if (!key) return fail('That key does not exist.', 'not-found')
  const text = typeof reason === 'string' ? reason.trim().slice(0, 200) : ''
  let allowed = key.userId === user.id || isLabAdmin((user.staffRole ?? null) as StaffRole | null)
  if (!allowed) {
    const heads = await db.select({ labId: labStaff.labId }).from(labStaff).where(and(eq(labStaff.userId, user.id), eq(labStaff.role, 'head')))
    if (heads.length > 0) {
      const shared = await db
        .select({ id: labBookings.id })
        .from(labBookings)
        .where(and(eq(labBookings.userId, key.userId), inArray(labBookings.labId, heads.map((h) => h.labId))))
        .limit(1)
      allowed = shared.length > 0
    }
  }
  if (!allowed) return fail('You cannot revoke that key.', 'forbidden')
  if (key.userId !== user.id && text.length < 3) return fail('Give a short reason.', 'invalid')
  if (key.revokedAt) return { ok: true }
  await db.transaction(async (tx) => {
    const done = await tx
      .update(labDeviceKeys)
      .set({ revokedAt: now, revokedBy: user.id, revokedReason: text || null })
      .where(and(eq(labDeviceKeys.id, keyId), isNull(labDeviceKeys.revokedAt)))
      .returning({ id: labDeviceKeys.id })
    if (done.length > 0) {
      await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'lab_device_key_revoked', entityType: 'lab_device_key', entityId: keyId, before: { revoked: false }, after: { revoked: true, reason: text || null } })
    }
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------------- lookups

async function staffRoleOf(userId: string): Promise<StaffRole | null> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { staffRole: true, isActive: true } })
  return row?.isActive ? ((row.staffRole ?? null) as StaffRole | null) : null
}

/** DB-backed lookups for the pure decision function. A deactivated account's keys never resolve. */
export const dbLookups: Lookups = {
  async key(keyId): Promise<KeyRecord | null> {
    const row = await db.query.labDeviceKeys.findFirst({ where: eq(labDeviceKeys.id, keyId) })
    if (!row) return null
    const owner = await db.query.users.findFirst({ where: eq(users.id, row.userId), columns: { isActive: true } })
    if (!owner?.isActive) return null
    const raw = decodePublicKey(row.publicKey)
    const publicKey = raw ? await importPublicKeyRaw(raw) : null
    if (!publicKey) return null
    return { userId: row.userId, publicKey, revokedAtMs: row.revokedAt?.getTime() ?? null }
  },
  async booking(id): Promise<BookingFacts | null> {
    const row = await db.query.labBookings.findFirst({ where: eq(labBookings.id, id) })
    if (!row) return null
    return { id: row.id, labId: row.labId, userId: row.userId, startsAtMs: row.startsAt.getTime(), endsAtMs: row.endsAt.getTime(), status: row.status, assistantUserId: row.assistantUserId }
  },
  async labRole(userId, labId): Promise<LabRole> {
    if (isLabAdmin(await staffRoleOf(userId))) return 'admin'
    const row = await db.query.labStaff.findFirst({ where: and(eq(labStaff.userId, userId), eq(labStaff.labId, labId)), columns: { role: true } })
    return row?.role ?? null
  },
}

// ---------------------------------------------------------------------------------- context and roster

export type KeyEntry = { keyId: string; publicKey: string }

/** Active, unrevoked public keys of a set of users. */
async function activeKeysFor(userIds: string[]): Promise<Map<string, KeyEntry[]>> {
  const out = new Map<string, KeyEntry[]>()
  if (userIds.length === 0) return out
  const rows = await db
    .select({ userId: labDeviceKeys.userId, id: labDeviceKeys.id, publicKey: labDeviceKeys.publicKey })
    .from(labDeviceKeys)
    .where(and(inArray(labDeviceKeys.userId, userIds), isNull(labDeviceKeys.revokedAt)))
  for (const r of rows) out.set(r.userId, [...(out.get(r.userId) ?? []), { keyId: r.id, publicKey: r.publicKey }])
  return out
}

export type CheckState = 'none' | 'partial' | 'verified'
export type BookingCheckSummary = { in: CheckState; out: CheckState; reviewPending: boolean }

async function summariseChecks(bookingIds: string[]): Promise<Map<string, BookingCheckSummary>> {
  const out = new Map<string, BookingCheckSummary>()
  for (const id of bookingIds) out.set(id, { in: 'none', out: 'none', reviewPending: false })
  if (bookingIds.length === 0) return out
  const checks = await db.select().from(labQrChecks).where(inArray(labQrChecks.bookingId, bookingIds))
  for (const c of checks) {
    const s = out.get(c.bookingId)!
    s[c.action] = c.state === 'verified' ? 'verified' : 'partial'
  }
  const pending = await db
    .select({ bookingId: labScanEvents.bookingId })
    .from(labScanEvents)
    .where(and(inArray(labScanEvents.bookingId, bookingIds), eq(labScanEvents.status, 'review')))
  for (const p of pending) out.get(p.bookingId)!.reviewPending = true
  return out
}

/**
 * What the booker's device needs to show a pass: the booking, the time window, and the public keys of
 * the people who staff the lab (so it can check a desk code is genuinely signed by lab staff).
 */
export async function getPassContext(bookingId: string) {
  const user = await requireUserOrThrow()
  const booking = await db.query.labBookings.findFirst({ where: eq(labBookings.id, bookingId) })
  if (!booking || booking.userId !== user.id) return fail('That booking does not exist.', 'not-found')
  if (booking.status !== 'approved' && booking.status !== 'completed') return fail('Only an approved booking has a pass.', 'forbidden')
  const lab = await db.query.labs.findFirst({ where: eq(labs.id, booking.labId), columns: { id: true, name: true } })
  const staff = await db.select({ userId: labStaff.userId }).from(labStaff).where(eq(labStaff.labId, booking.labId))
  const keys = await activeKeysFor(staff.map((s) => s.userId))
  const summary = (await summariseChecks([booking.id])).get(booking.id)!
  return {
    ok: true as const,
    booking: { id: booking.id, labId: booking.labId, labName: lab?.name ?? '', startsAt: booking.startsAt.toISOString(), endsAt: booking.endsAt.toISOString(), status: booking.status },
    staffKeys: [...keys.values()].flat(),
    checks: summary,
    myKeys: (await activeKeysFor([user.id])).get(user.id) ?? [],
  }
}

export type RosterEntry = {
  bookingId: string
  labId: string
  labName: string
  labSlug: string
  startsAt: string
  endsAt: string
  /** Display name for the visual ID check. No e-mail address is ever sent to a scanning device. */
  studentName: string
  studentKeys: KeyEntry[]
  checks: BookingCheckSummary
}

/**
 * The roster a scanning device may cache: approved or checked-in bookings in the next 24 hours (and those running
 * now) that this person may scan. An assistant sees only bookings assigned to them; heads and admins
 * see their lab's. Expires with the cache TTL on the device.
 */
export async function getRoster(now = new Date()) {
  const user = await requireUserOrThrow()
  const staffRole = await staffRoleOf(user.id)
  const memberships = await db.select({ labId: labStaff.labId, role: labStaff.role }).from(labStaff).where(eq(labStaff.userId, user.id))
  const admin = isLabAdmin(staffRole)
  if (!admin && memberships.length === 0) return fail('You do not run a lab.', 'forbidden')

  const horizon = new Date(now.getTime() + ROSTER_CACHE_TTL_MS)
  const base = and(inArray(labBookings.status, ['approved', 'completed']), lte(labBookings.startsAt, horizon), gte(labBookings.endsAt, new Date(now.getTime() - 60 * 60 * 1000)))
  const headLabs = memberships.filter((m) => m.role === 'head').map((m) => m.labId)
  const assistantLabs = memberships.filter((m) => m.role === 'assistant').map((m) => m.labId)
  const scope = admin
    ? base
    : and(
        base,
        or(
          // an assistant is limited to the bookings assigned to them, as manual attendance is
          assistantLabs.length > 0 ? and(eq(labBookings.assistantUserId, user.id), inArray(labBookings.labId, assistantLabs)) : undefined,
          headLabs.length > 0 ? inArray(labBookings.labId, headLabs) : undefined,
        ),
      )
  const rows = await db
    .select({ booking: labBookings, labName: labs.name, labSlug: labs.slug, studentName: users.name })
    .from(labBookings)
    .innerJoin(labs, eq(labs.id, labBookings.labId))
    .innerJoin(users, eq(users.id, labBookings.userId))
    .where(scope)
    .orderBy(asc(labBookings.startsAt))
    .limit(300)
  const keys = await activeKeysFor([...new Set(rows.map((r) => r.booking.userId))])
  const checks = await summariseChecks(rows.map((r) => r.booking.id))
  const entries: RosterEntry[] = rows.map((r) => ({
    bookingId: r.booking.id,
    labId: r.booking.labId,
    labName: r.labName,
    labSlug: r.labSlug,
    startsAt: r.booking.startsAt.toISOString(),
    endsAt: r.booking.endsAt.toISOString(),
    studentName: r.studentName?.trim() || 'Member',
    studentKeys: keys.get(r.booking.userId) ?? [],
    checks: checks.get(r.booking.id)!,
  }))
  const myKeys = (await activeKeysFor([user.id])).get(user.id) ?? []
  return { ok: true as const, generatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ROSTER_CACHE_TTL_MS).toISOString(), entries, myKeys }
}

/** Who the device is signed in as, and whether they run any lab. The page caches this for offline use. */
export async function getMe() {
  const user = await requireUserOrThrow()
  const memberships = await db.select({ labId: labStaff.labId }).from(labStaff).where(eq(labStaff.userId, user.id)).limit(1)
  const staff = memberships.length > 0 || isLabAdmin(await staffRoleOf(user.id))
  const row = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { name: true } })
  return { ok: true as const, userId: user.id, name: row?.name?.trim() || 'Member', isStaff: staff }
}

export type MyPass = {
  bookingId: string
  labId: string
  labName: string
  startsAt: string
  endsAt: string
  status: string
  staffKeys: KeyEntry[]
  checks: BookingCheckSummary
}

/**
 * The booker's own approved bookings that are running now or start within 24 hours, with the public
 * keys of the lab's staff, so the pass screen can run from a device-side cache with no network.
 */
export async function listMyPasses(now = new Date()) {
  const user = await requireUserOrThrow()
  const rows = await db
    .select({ booking: labBookings, labName: labs.name })
    .from(labBookings)
    .innerJoin(labs, eq(labs.id, labBookings.labId))
    .where(
      and(
        eq(labBookings.userId, user.id),
        inArray(labBookings.status, ['approved', 'completed']),
        lte(labBookings.startsAt, new Date(now.getTime() + ROSTER_CACHE_TTL_MS)),
        gte(labBookings.endsAt, new Date(now.getTime() - 60 * 60 * 1000)),
      ),
    )
    .orderBy(asc(labBookings.startsAt))
    .limit(20)
  const labIds = [...new Set(rows.map((r) => r.booking.labId))]
  const staff = labIds.length ? await db.select({ labId: labStaff.labId, userId: labStaff.userId }).from(labStaff).where(inArray(labStaff.labId, labIds)) : []
  const keys = await activeKeysFor([...new Set(staff.map((s) => s.userId))])
  const checks = await summariseChecks(rows.map((r) => r.booking.id))
  const passes: MyPass[] = rows.map((r) => ({
    bookingId: r.booking.id,
    labId: r.booking.labId,
    labName: r.labName,
    startsAt: r.booking.startsAt.toISOString(),
    endsAt: r.booking.endsAt.toISOString(),
    status: r.booking.status,
    staffKeys: staff.filter((s) => s.labId === r.booking.labId).flatMap((s) => keys.get(s.userId) ?? []),
    checks: checks.get(r.booking.id)!,
  }))
  return { ok: true as const, generatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ROSTER_CACHE_TTL_MS).toISOString(), passes }
}

export async function getBookingChecks(bookingId: string) {
  const user = await requireUserOrThrow()
  const booking = await db.query.labBookings.findFirst({ where: eq(labBookings.id, bookingId), columns: { id: true, userId: true, labId: true, assistantUserId: true } })
  if (!booking) return fail('That booking does not exist.', 'not-found')
  if (booking.userId !== user.id) {
    const actor = await actorFor(booking.labId)
    const mayView = actor.isAdmin || actor.role === 'head' || (actor.role === 'assistant' && booking.assistantUserId === user.id)
    if (!mayView) return fail('That booking does not exist.', 'not-found')
  }
  return { ok: true as const, checks: (await summariseChecks([bookingId])).get(bookingId)! }
}

// ---------------------------------------------------------------------------------- scan intake

export type ScanOutcome = {
  id: string | null
  status: 'accepted' | 'review' | 'rejected'
  code: string | null
  /** After this event: what the booking and direction look like. Present for accepted events. */
  check: { action: Action; state: 'partial' | 'verified' } | null
  duplicate: boolean
}

type EventRow = typeof labScanEvents.$inferSelect

const UNTRUSTED_REJECTIONS = ['malformed', 'unknown-key', 'bad-signature', 'not-your-key'] as const

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null
  return e?.code === '23505' || e?.cause?.code === '23505'
}

/**
 * Takes a batch of signed scan events from the signed-in person's outbox. Idempotent: an event id the
 * server has seen again returns the stored outcome and changes nothing. Each event is decided on its
 * own; one bad event never blocks the rest.
 */
export async function submitScanBatch(input: { clientNowMs: unknown; events: unknown }, now = new Date()): Promise<QrResult<{ results: ScanOutcome[] }>> {
  const user = await requireUserOrThrow()
  if (typeof input.clientNowMs !== 'number' || !Number.isSafeInteger(input.clientNowMs) || input.clientNowMs <= 0) return fail('Send the device time with the batch.', 'invalid')
  if (!Array.isArray(input.events) || input.events.length === 0 || input.events.length > MAX_BATCH_EVENTS || !input.events.every((e) => typeof e === 'string')) {
    return fail(`Send between 1 and ${MAX_BATCH_EVENTS} events.`, 'invalid')
  }
  const results: ScanOutcome[] = []
  for (const token of input.events as string[]) {
    results.push(await processEvent(token, user.id, input.clientNowMs, now))
  }
  return { ok: true, results }
}

async function processEvent(token: string, userId: string, clientNowMs: number, now: Date): Promise<ScanOutcome> {
  const parsed = parseToken(token, 'scan')
  if (!parsed) return { id: null, status: 'rejected', code: 'malformed', check: null, duplicate: false }
  const eventId = parsed.payload.id

  const prior = await db.query.labScanEvents.findFirst({ where: eq(labScanEvents.id, eventId) })
  if (prior) {
    if (prior.scannerUserId !== userId) return { id: eventId, status: 'rejected', code: 'not-your-key', check: null, duplicate: true }
    return outcomeFromRow(prior, true)
  }

  const decision = await decideScan(token, { submitterUserId: userId, serverNowMs: now.getTime(), clientNowMs }, dbLookups)
  return persist(parsed.payload, token, decision, userId, clientNowMs, now)
}

async function outcomeFromRow(row: EventRow, duplicate: boolean): Promise<ScanOutcome> {
  let check: ScanOutcome['check'] = null
  if (row.status === 'accepted') {
    const c = await db.query.labQrChecks.findFirst({ where: and(eq(labQrChecks.bookingId, row.bookingId), eq(labQrChecks.action, row.action)) })
    if (c) check = { action: row.action, state: c.state === 'verified' ? 'verified' : 'partial' }
  }
  return { id: row.id, status: row.status, code: row.code, check, duplicate }
}

async function persist(
  event: { id: string; sd: 'staff' | 'student'; a: Action; k: string; at: number; bk: string },
  token: string,
  decision: Decision,
  userId: string,
  clientNowMs: number,
  now: Date,
): Promise<ScanOutcome> {
  // A rejection whose envelope is not provably the submitter's own is never stored. Otherwise anyone
  // who saw an event token could mutate it, keep its id, and use up that id so the real one is refused.
  if (decision.status === 'rejected' && (UNTRUSTED_REJECTIONS as readonly string[]).includes(decision.code)) {
    return { id: event.id, status: 'rejected', code: decision.code, check: null, duplicate: false }
  }
  const detail = decision.status === 'accepted' ? decision : decision.status === 'review' ? decision.detail : null
  // A rejected event is kept only when its booking exists (foreign key) and the signer was a person we know.
  const booking = await db.query.labBookings.findFirst({ where: eq(labBookings.id, event.bk), columns: { id: true } })
  if (!booking) return { id: event.id, status: 'rejected', code: decision.status === 'rejected' ? decision.code : 'booking-not-found', check: null, duplicate: false }

  const code = decision.status === 'accepted' ? null : decision.code
  const row = {
    id: event.id,
    bookingId: event.bk,
    side: event.sd,
    action: event.a,
    scannerUserId: userId,
    scannerKeyId: event.k,
    innerKeyId: detail?.innerKeyId ?? null,
    innerUserId: detail?.innerUserId ?? null,
    innerNonce: detail?.innerNonce ?? null,
    innerStep: detail?.innerStep ?? null,
    token,
    status: decision.status,
    code,
    clientAtMs: event.at,
    clientSyncAtMs: clientNowMs,
    effectiveAt: detail ? new Date(detail.effectiveAtMs) : null,
    receivedAt: now,
  } as const

  try {
    return await db.transaction(async (tx) => {
      // Serialise per booking so two simultaneous halves of one exchange pair exactly once.
      await tx.select({ id: labBookings.id }).from(labBookings).where(eq(labBookings.id, event.bk)).for('update')
      const [inserted] = await tx.insert(labScanEvents).values(row).onConflictDoNothing({ target: labScanEvents.id }).returning({ id: labScanEvents.id })
      if (!inserted) {
        const existing = await tx.query.labScanEvents.findFirst({ where: eq(labScanEvents.id, event.id) })
        return existing ? { id: event.id, status: existing.status, code: existing.code, check: null, duplicate: true } : { id: event.id, status: 'rejected', code: 'conflict', check: null, duplicate: true }
      }
      if (decision.status !== 'accepted') return { id: event.id, status: decision.status, code, check: null, duplicate: false }
      const check = await pairAndRecord(tx, event.bk, event.a, userId, now)
      return { id: event.id, status: 'accepted', code: null, check, duplicate: false }
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    // The pass or challenge nonce was already used by an earlier, live event: a replay.
    await db
      .insert(labScanEvents)
      .values({ ...row, status: 'rejected', code: 'replay', innerKeyId: null, innerNonce: null, effectiveAt: null })
      .onConflictDoNothing({ target: labScanEvents.id })
    return { id: event.id, status: 'rejected', code: 'replay', check: null, duplicate: false }
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** After an accepted event: see whether both directions now exist, and write the check and, on check-in, the attendance row. */
async function pairAndRecord(tx: Tx, bookingId: string, action: Action, actorId: string, now: Date): Promise<{ action: Action; state: 'partial' | 'verified' }> {
  const accepted = await tx
    .select({ id: labScanEvents.id, side: labScanEvents.side, effectiveAt: labScanEvents.effectiveAt })
    .from(labScanEvents)
    .where(and(eq(labScanEvents.bookingId, bookingId), eq(labScanEvents.action, action), eq(labScanEvents.status, 'accepted')))
  const events = accepted.filter((e) => e.effectiveAt).map((e) => ({ id: e.id, side: e.side, effectiveAtMs: e.effectiveAt!.getTime() }))
  const pair = pickPair(events)
  const firstStaff = events.find((e) => e.side === 'staff')
  const firstStudent = events.find((e) => e.side === 'student')

  const existing = await tx.query.labQrChecks.findFirst({ where: and(eq(labQrChecks.bookingId, bookingId), eq(labQrChecks.action, action)) })
  if (existing?.state === 'verified') return { action, state: 'verified' }

  const values = {
    bookingId,
    action,
    state: pair ? ('verified' as const) : firstStaff && !firstStudent ? ('partial_staff' as const) : ('partial_student' as const),
    staffEventId: pair?.staff.id ?? firstStaff?.id ?? null,
    studentEventId: pair?.student.id ?? firstStudent?.id ?? null,
    verifiedAt: pair ? now : null,
    updatedAt: now,
  }
  await tx
    .insert(labQrChecks)
    .values(values)
    .onConflictDoUpdate({ target: [labQrChecks.bookingId, labQrChecks.action], set: { state: values.state, staffEventId: values.staffEventId, studentEventId: values.studentEventId, verifiedAt: values.verifiedAt, updatedAt: now } })

  if (!pair) return { action, state: 'partial' }

  await tx.insert(auditLogs).values({ actorUserId: actorId, action: `lab_qr_${action}_verified`, entityType: 'lab_booking', entityId: bookingId, before: null, after: { staffEventId: pair.staff.id, studentEventId: pair.student.id, method: 'qr' } })
  if (action === 'in') {
    // A verified check-in is the same fact a manual "attended" is: close the booking and write the row, labelled `qr`.
    const closed = await tx
      .update(labBookings)
      .set({ status: 'completed', updatedAt: now })
      .where(and(eq(labBookings.id, bookingId), eq(labBookings.status, 'approved')))
      .returning({ id: labBookings.id })
    if (closed.length > 0) {
      await tx.insert(labAttendance).values({ bookingId, outcome: 'attended', markedBy: null, markedAt: now, reason: null, method: 'qr' }).onConflictDoNothing()
    }
  }
  return { action, state: 'verified' }
}

// ---------------------------------------------------------------------------------- review queue

export async function listReviewQueue(labId: string) {
  const actor = await actorFor(labId)
  requireManager(actor)
  const rows = await db
    .select({ event: labScanEvents, studentName: users.name, startsAt: labBookings.startsAt, endsAt: labBookings.endsAt })
    .from(labScanEvents)
    .innerJoin(labBookings, eq(labBookings.id, labScanEvents.bookingId))
    .innerJoin(users, eq(users.id, labBookings.userId))
    .where(and(eq(labBookings.labId, labId), eq(labScanEvents.status, 'review')))
    .orderBy(asc(labScanEvents.receivedAt))
    .limit(200)
  return rows.map((r) => ({
    id: r.event.id,
    bookingId: r.event.bookingId,
    side: r.event.side,
    action: r.event.action,
    code: r.event.code,
    studentName: r.studentName?.trim() || 'Member',
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    effectiveAt: r.event.effectiveAt?.toISOString() ?? null,
    receivedAt: r.event.receivedAt.toISOString(),
  }))
}

/** A head approves or declines a held scan. Approving makes it count (and may complete the pair); both are audited. */
export async function decideReview(eventId: string, approve: boolean, note: unknown, now = new Date()): Promise<QrResult> {
  const row = await db.query.labScanEvents.findFirst({ where: eq(labScanEvents.id, eventId) })
  if (!row) return fail('That scan does not exist.', 'not-found')
  const booking = await db.query.labBookings.findFirst({ where: eq(labBookings.id, row.bookingId), columns: { labId: true } })
  if (!booking) return fail('That scan does not exist.', 'not-found')
  const actor = await actorFor(booking.labId)
  if (!canManage(actor)) return fail('Only the lab head can decide a held scan.', 'forbidden')
  const text = typeof note === 'string' ? note.trim().slice(0, 300) : ''
  if (text.length < 3) return fail('Give a short note for the record.', 'invalid')
  const outcome = await db.transaction(async (tx) => {
    await tx.select({ id: labBookings.id }).from(labBookings).where(eq(labBookings.id, row.bookingId)).for('update')
    const updated = await tx
      .update(labScanEvents)
      .set({ status: approve ? 'accepted' : 'rejected', code: approve ? row.code : 'review-declined', reviewedBy: actor.id, reviewedAt: now, reviewNote: text })
      .where(and(eq(labScanEvents.id, eventId), eq(labScanEvents.status, 'review')))
      .returning({ id: labScanEvents.id })
    if (updated.length === 0) return false
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: approve ? 'lab_qr_review_approved' : 'lab_qr_review_declined', entityType: 'lab_scan_event', entityId: eventId, before: { status: 'review', code: row.code }, after: { status: approve ? 'accepted' : 'rejected', note: text } })
    if (approve) await pairAndRecord(tx, row.bookingId, row.action, actor.id, now)
    return true
  })
  return outcome ? { ok: true } : fail('That scan was already decided.', 'conflict')
}
