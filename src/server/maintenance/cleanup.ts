import { lt, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { sessions, verificationTokens } from '@/db/schema'

/**
 * Removes rows that can never be used again. Nothing here deletes anything a person or an auditor could
 * still need: an expired session cannot sign anyone in, an expired token cannot verify anything, and a
 * rate-limit bucket idle for longer than its refill time is indistinguishable from a new one.
 */

/** A bucket refills completely within the longest window in RATE_LIMITS (one hour); two days is far past it. */
export const RATE_LIMIT_IDLE_MS = 2 * 24 * 60 * 60 * 1000

export type CleanupResult = { sessions: number; tokens: number; rateLimits: number }

export async function cleanupExpired(now = new Date()): Promise<CleanupResult> {
  const expiredSessions = await db.delete(sessions).where(lt(sessions.expires, now)).returning({ token: sessions.sessionToken })
  const expiredTokens = await db.delete(verificationTokens).where(lt(verificationTokens.expires, now)).returning({ identifier: verificationTokens.identifier })
  const idle = new Date(now.getTime() - RATE_LIMIT_IDLE_MS)
  const idleBuckets = await db.execute<{ key: string }>(sql`DELETE FROM app.rate_limits WHERE updated_at < ${idle} RETURNING key`)
  return { sessions: expiredSessions.length, tokens: expiredTokens.length, rateLimits: idleBuckets.rows.length }
}

const DAY_MS = 24 * 60 * 60 * 1000
let timer: ReturnType<typeof setInterval> | undefined

/** Runs once shortly after start and then daily, inside the web process (a single host, and the deletes are idempotent). */
export function startCleanupWorker(): void {
  if (timer) return
  const run = () =>
    cleanupExpired()
      .then((result) => console.log(`maintenance_cleanup sessions=${result.sessions} tokens=${result.tokens} rate_limits=${result.rateLimits}`))
      .catch((error) => console.error('maintenance_cleanup_failed', error instanceof Error ? error.message : String(error)))
  setTimeout(run, 10 * 60 * 1000).unref?.()
  timer = setInterval(run, DAY_MS)
  timer.unref?.()
}
