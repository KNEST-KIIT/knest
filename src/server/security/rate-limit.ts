import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { clientIpFromHeaders } from './client-ip'

type RateLimitConfig = { capacity: number; refillIntervalSeconds: number }

/**
 * One documented constant per limited route (PHASE-10-12-IMPLEMENTATION-PLAN.md
 * §4.1 acceptance criteria: the bucket size must be a named constant, not a
 * magic number). `refillIntervalSeconds` is how long a fully-drained bucket
 * takes to refill to `capacity` — not a request-per-second rate directly.
 */
export const RATE_LIMITS = {
  login: { capacity: 5, refillIntervalSeconds: 15 * 60 },
  signup: { capacity: 5, refillIntervalSeconds: 60 * 60 },
  passwordResetRequest: { capacity: 5, refillIntervalSeconds: 60 * 60 },
  applicationStart: { capacity: 10, refillIntervalSeconds: 60 * 60 },
  fileUpload: { capacity: 20, refillIntervalSeconds: 60 * 60 },
  // Fire-and-forget selector clicks: far above what a person produces, far below flooding.
  analyticsTrack: { capacity: 60, refillIntervalSeconds: 10 * 60 },
  // Public contact form: a person sends a few, a bot sends hundreds.
  enquirySubmit: { capacity: 3, refillIntervalSeconds: 60 * 60 },
  // Sends an e-mail: bounded per address as well as per connection.
  verifySend: { capacity: 5, refillIntervalSeconds: 60 * 60 },
  // Guessing a 256-bit token is hopeless; this stops hammering anyway.
  tokenConfirm: { capacity: 20, refillIntervalSeconds: 60 * 60 },
  // Autosave while typing: generous, but not unlimited.
  answerSave: { capacity: 600, refillIntervalSeconds: 60 * 60 },
  onboardingStep: { capacity: 120, refillIntervalSeconds: 60 * 60 },
  eventRegister: { capacity: 60, refillIntervalSeconds: 60 * 60 },
  notificationRead: { capacity: 300, refillIntervalSeconds: 60 * 60 },
  labRequest: { capacity: 20, refillIntervalSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitConfig>

/**
 * A Postgres-backed token bucket — one atomic UPSERT per check, no Redis
 * (§4.1: not needed at this scale). The bucket starts full; each check
 * refills it continuously by elapsed-time × (capacity / refillIntervalSeconds)
 * before consuming one token. A drained bucket is allowed to drift to -1, and
 * no further, so a burst of already-rejected requests doesn't push the debt
 * (and so the recovery time) out any further than a single rejected attempt
 * would.
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<boolean> {
  const refillPerSecond = config.capacity / config.refillIntervalSeconds

  const result = await db.execute<{ tokens: number }>(sql`
    INSERT INTO app.rate_limits AS rl (key, tokens, updated_at)
    VALUES (${key}, ${config.capacity - 1}, now())
    ON CONFLICT (key) DO UPDATE SET
      tokens = GREATEST(
        -1,
        LEAST(
          ${config.capacity}::double precision,
          rl.tokens + EXTRACT(EPOCH FROM (now() - rl.updated_at)) * ${refillPerSecond}::double precision
        ) - 1
      ),
      updated_at = now()
    RETURNING tokens
  `)

  const tokens = result.rows[0]?.tokens
  return tokens !== undefined && Number(tokens) >= 0
}

/** IP-keyed limits use the address from the trusted source for this deployment (see client-ip.ts). */
export function clientIp(request: Request): string {
  return clientIpFromHeaders((name) => request.headers.get(name), process.env)
}

export class RateLimitError extends Error {
  constructor() {
    super('Too many requests')
    this.name = 'RateLimitError'
  }
}

/** Throws RateLimitError instead of returning a boolean, for call sites that just want to bail out. */
export async function enforceRateLimit(key: string, config: RateLimitConfig): Promise<void> {
  const allowed = await checkRateLimit(key, config)
  if (!allowed) throw new RateLimitError()
}
