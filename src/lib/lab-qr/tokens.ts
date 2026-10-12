import { MAX_TOKEN_LENGTH, STEP_MS, TOKEN_PREFIX, type Action, type Side } from './constants'
import { concatBytes, fromBase64Url, fromUtf8, toBase64Url, utf8 } from './encoding'
import { KEY_ID_PATTERN, randomNonce, signBytes, verifyBytes } from './keys'

/**
 * The wire format of the lab attendance protocol: `K1.<payload>.<signature>`, where payload is the
 * base64url of compact UTF-8 JSON and signature is the base64url of an ECDSA P-256 signature over
 *
 *     "knest-lab-attendance/v1/<type>\n" || payload bytes
 *
 * The domain prefix means a signature made for one message type can never be replayed as another.
 * Payloads carry no personal data: only random identifiers, key ids and times.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const NONCE = /^[A-Za-z0-9_-]{16}$/

export type TokenType = 'pass' | 'chal' | 'scan' | 'reg'

/** A student's short-lived pass for one booking and one action. Signed by the student's device key. */
export type PassPayload = { v: 1; t: 'pass'; a: Action; b: string; k: string; s: number; n: string }
/** The lab desk's code, signed by the assistant's device key. `m` is the mode the desk is in. */
export type ChallengePayload = { v: 1; t: 'chal'; m: Action; l: string; k: string; s: number; n: string }
/**
 * A scan event, signed by the scanning device. `sd` says which side the scanner is: `staff` scanned a
 * student pass, `student` scanned the lab desk's challenge. `tok` is the scanned token, verbatim.
 * `ol` is signed by the device: 1 when it had no connection at the time, 0 when it was online and
 * about to send. The server holds an online event to its own clock and only corrects the time of an
 * offline one, so an online device cannot pick the time its scan is judged against.
 */
export type ScanPayload = { v: 1; t: 'scan'; id: string; sd: Side; a: Action; k: string; at: number; bk: string; ol: 0 | 1; tok: string }
/** Proof of possession when a device registers its public key. Binds the key to a user and a moment. */
export type RegisterPayload = { v: 1; t: 'reg'; u: string; k: string; at: number }

export type PayloadFor = { pass: PassPayload; chal: ChallengePayload; scan: ScanPayload; reg: RegisterPayload }

const isAction = (value: unknown): value is Action => value === 'in' || value === 'out'
const isStep = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const isKeyId = (value: unknown): value is string => typeof value === 'string' && KEY_ID_PATTERN.test(value)
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)
const isNonce = (value: unknown): value is string => typeof value === 'string' && NONCE.test(value)

/** Strict shape checks. Anything with a missing, extra or wrongly typed field is rejected. */
const VALIDATORS: { [T in TokenType]: (raw: Record<string, unknown>) => raw is PayloadFor[T] } = {
  pass: (r): r is PassPayload =>
    sameKeys(r, ['v', 't', 'a', 'b', 'k', 's', 'n']) && r.v === 1 && r.t === 'pass' && isAction(r.a) && isUuid(r.b) && isKeyId(r.k) && isStep(r.s) && isNonce(r.n),
  chal: (r): r is ChallengePayload =>
    sameKeys(r, ['v', 't', 'm', 'l', 'k', 's', 'n']) && r.v === 1 && r.t === 'chal' && isAction(r.m) && isUuid(r.l) && isKeyId(r.k) && isStep(r.s) && isNonce(r.n),
  scan: (r): r is ScanPayload =>
    sameKeys(r, ['v', 't', 'id', 'sd', 'a', 'k', 'at', 'bk', 'ol', 'tok']) &&
    r.v === 1 &&
    r.t === 'scan' &&
    isUuid(r.id) &&
    (r.sd === 'staff' || r.sd === 'student') &&
    isAction(r.a) &&
    isKeyId(r.k) &&
    isTime(r.at) &&
    isUuid(r.bk) &&
    (r.ol === 0 || r.ol === 1) &&
    typeof r.tok === 'string' &&
    r.tok.length > 0 &&
    r.tok.length <= MAX_TOKEN_LENGTH,
  reg: (r): r is RegisterPayload =>
    sameKeys(r, ['v', 't', 'u', 'k', 'at']) && r.v === 1 && r.t === 'reg' && typeof r.u === 'string' && r.u.length > 0 && r.u.length <= 128 && isKeyId(r.k) && isTime(r.at),
}

function sameKeys(record: Record<string, unknown>, keys: string[]): boolean {
  const have = Object.keys(record)
  return have.length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(record, k))
}

const domain = (type: TokenType) => utf8(`knest-lab-attendance/v1/${type}\n`)

export const stepAt = (ms: number): number => Math.floor(ms / STEP_MS)
export const stepStart = (step: number): number => step * STEP_MS

export type ParsedToken<T extends TokenType = TokenType> = { payload: PayloadFor[T]; payloadBytes: Uint8Array; signature: Uint8Array }
export type ParseFailure = 'malformed'

/** Structural parse only: nothing is trusted until `verifyToken` has checked the signature. */
export function parseToken<T extends TokenType>(token: string, expected: T): ParsedToken<T> | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null
  const payloadBytes = fromBase64Url(parts[1]!)
  const signature = fromBase64Url(parts[2]!)
  if (!payloadBytes || !signature || signature.length !== 64) return null
  let raw: unknown
  try {
    raw = JSON.parse(fromUtf8(payloadBytes))
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (record.t !== expected) return null
  if (!VALIDATORS[expected](record)) return null
  return { payload: record as PayloadFor[T], payloadBytes, signature }
}

/** Sign a payload with a device private key and return the token string. */
export async function createToken<T extends TokenType>(payload: PayloadFor[T], privateKey: CryptoKey): Promise<string> {
  const payloadBytes = utf8(JSON.stringify(payload))
  const signature = await signBytes(privateKey, concatBytes(domain(payload.t), payloadBytes))
  const token = `${TOKEN_PREFIX}.${toBase64Url(payloadBytes)}.${toBase64Url(signature)}`
  if (token.length > MAX_TOKEN_LENGTH) throw new Error('token too long')
  return token
}

export type VerifyResult<T extends TokenType> =
  | { ok: true; payload: PayloadFor[T] }
  | { ok: false; code: 'malformed' | 'unknown-key' | 'bad-signature' }

/** Resolves a key id to a public key. Returns null when the id is not registered. */
export type KeyResolver = (keyId: string) => Promise<CryptoKey | null>

/** Parse, find the signer's registered public key by the id in the payload, and check the signature. */
export async function verifyToken<T extends TokenType>(token: string, expected: T, resolveKey: KeyResolver): Promise<VerifyResult<T>> {
  const parsed = parseToken(token, expected)
  if (!parsed) return { ok: false, code: 'malformed' }
  const key = await resolveKey(parsed.payload.k)
  if (!key) return { ok: false, code: 'unknown-key' }
  const valid = await verifyBytes(key, concatBytes(domain(expected), parsed.payloadBytes), parsed.signature)
  return valid ? { ok: true, payload: parsed.payload } : { ok: false, code: 'bad-signature' }
}

// ---- builders -------------------------------------------------------------------------------

export function createPass(args: { action: Action; bookingId: string; keyId: string; nowMs: number }, privateKey: CryptoKey): Promise<string> {
  return createToken<'pass'>({ v: 1, t: 'pass', a: args.action, b: args.bookingId, k: args.keyId, s: stepAt(args.nowMs), n: randomNonce() }, privateKey)
}

export function createChallenge(args: { mode: Action; labId: string; keyId: string; nowMs: number }, privateKey: CryptoKey): Promise<string> {
  return createToken<'chal'>({ v: 1, t: 'chal', m: args.mode, l: args.labId, k: args.keyId, s: stepAt(args.nowMs), n: randomNonce() }, privateKey)
}

export function createScanEvent(
  args: { id: string; side: Side; action: Action; keyId: string; atMs: number; bookingId: string; scanned: string; offline: boolean },
  privateKey: CryptoKey,
): Promise<string> {
  return createToken<'scan'>(
    { v: 1, t: 'scan', id: args.id, sd: args.side, a: args.action, k: args.keyId, at: args.atMs, bk: args.bookingId, ol: args.offline ? 1 : 0, tok: args.scanned },
    privateKey,
  )
}

export function createRegistrationProof(args: { userId: string; keyId: string; nowMs: number }, privateKey: CryptoKey): Promise<string> {
  return createToken<'reg'>({ v: 1, t: 'reg', u: args.userId, k: args.keyId, at: args.nowMs }, privateKey)
}

/** Whether a token's step is close enough to a reference time, in whole steps. */
export function stepWithinTolerance(tokenStep: number, referenceMs: number, tolerance: number): boolean {
  return Math.abs(tokenStep - stepAt(referenceMs)) <= tolerance
}
