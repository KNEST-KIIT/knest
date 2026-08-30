import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

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

/** IP-keyed limits read the client's address off the proxy-set header — this app is never reached directly. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'unknown'
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
