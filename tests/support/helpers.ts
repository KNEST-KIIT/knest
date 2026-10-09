import { hash } from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { Pool } from 'pg'

export const BASE = () => {
  const url = process.env.TEST_BASE_URL
  if (!url) throw new Error('TEST_BASE_URL is not set: run `pnpm build` before `pnpm test:integration`.')
  return url
}

let pool: Pool | null = null
export function db(): Pool {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
  return pool
}
export async function closeDb() {
  await pool?.end()
  pool = null
}

export const PASSWORD = 'correct-horse-battery-staple-9'

type PlatformRole = 'student' | 'founder' | 'mentor' | 'investor' | 'alumni' | 'partner' | 'other'
type StaffRole = 'reviewer' | 'content_admin' | 'program_manager' | 'startup_manager' | 'mentor_manager' | 'lab_admin' | 'super_admin'

/** Inserts a verified user straight into app.users. Returns its id. */
export async function createUser(input: {
  email: string
  platformRole?: PlatformRole
  staffRole?: StaffRole | null
  isActive?: boolean
  /** bcrypt cost; production accounts use 12 */
  cost?: number
}): Promise<string> {
  const passwordHash = await hash(PASSWORD, input.cost ?? 10)
  const res = await db().query(
    `insert into app.users (id, email, name, password_hash, platform_role, staff_role, email_verified, is_active)
     values (gen_random_uuid()::text, $1, $2, $3, $4, $5, now(), $6)
     on conflict (email) do update set password_hash = excluded.password_hash
     returning id`,
    [input.email, input.email.split('@')[0], passwordHash, input.platformRole ?? 'student', input.staffRole ?? null, input.isActive ?? true],
  )
  return res.rows[0].id as string
}

export type Session = { cookie: string }

/** Signs in through the real login route and returns the session cookie. */
export async function login(email: string, password = PASSWORD): Promise<Session | null> {
  const res = await fetch(`${BASE()}/api/auth/password/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .filter((c): c is string => Boolean(c))
    .join('; ')
  return cookie ? { cookie } : null
}

// Test files run in separate processes against one server, so a shared sequence
// would hand the same address to several files and trip the per-IP login limit
// (5 per 15 minutes). Each process starts at its own random point in a /16 of
// the TEST-NET-2 documentation range.
let ipCounter = Math.floor(Math.random() * 65_000)
/** The rate limiter keys on the first x-forwarded-for hop; give each call its own. */
export function uniqueIp(): string {
  ipCounter = (ipCounter + 1) % 65_536
  return `198.51.${(ipCounter >> 8) & 255}.${ipCounter & 255}`
}

export async function get(path: string, session?: Session | null, headers: Record<string, string> = {}) {
  return fetch(`${BASE()}${path}`, {
    redirect: 'manual',
    headers: { ...(session ? { cookie: session.cookie } : {}), ...headers },
  })
}

export type CapturedMail = { from: string; to: string[]; body: string }

/** Messages the SMTP stub received (global-setup starts it and points the server at it). */
export function readMail(): CapturedMail[] {
  const file = process.env.TEST_SMTP_CAPTURE
  if (!file) return []
  return readFileSync(file, 'utf8')
    .split(String.fromCharCode(10))
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CapturedMail)
}

/** Decodes the text part of a captured MIME message (quoted-printable or base64). */
export function decodeMailText(raw: string): string {
  const crlf2 = String.fromCharCode(13, 10, 13, 10)
  const split = raw.indexOf(crlf2)
  const headers = split === -1 ? raw : raw.slice(0, split)
  const body = split === -1 ? '' : raw.slice(split + 4)
  if (/content-transfer-encoding:\s*base64/i.test(headers)) {
    return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8')
  }
  if (/content-transfer-encoding:\s*quoted-printable/i.test(headers)) {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
  }
  return body
}
