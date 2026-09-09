'use server'

import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { levelRequests, users } from '@/db/schema'
import { track } from '@/server/analytics/track'
import { requireUserOrThrow } from '@/server/auth/guards'
import { RATE_LIMITS, enforceRateLimit } from '@/server/security/rate-limit'
import { MAX_LEVEL } from './levels'
import { isLegalTransition } from './transitions'

export type ActionResult = { ok: true } | { ok: false; error: string }

/** Enough for a reviewer to decide on; short enough that nobody writes an essay into a textarea. */
const MIN_EVIDENCE = 60
const MAX_EVIDENCE = 2000

/**
 * A founder asking to be moved up.
 *
 * This is the gate that makes levels mean anything. `platformRole` and
 * `journeyStage` are both self-declared — anyone can call themselves a founder
 * at the 'established' stage — so the level is the one claim KNEST checks, and
 * this queue is where the checking happens.
 */
export async function requestLevelUp(input: {
  requestedLevel: number
  evidence: string
}): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const user = await requireUserOrThrow()
  await enforceRateLimit(`level-request:${user.id}`, RATE_LIMITS.levelRequest)

  const evidence = input.evidence?.trim() ?? ''
  if (evidence.length < MIN_EVIDENCE) {
    return { ok: false, error: 'Tell us a bit more — a couple of sentences at least.' }
  }
  if (evidence.length > MAX_EVIDENCE) {
    return { ok: false, error: 'That’s longer than we can read properly. Keep it under 2000 characters.' }
  }

  const requestedLevel = Math.trunc(Number(input.requestedLevel))
  if (!Number.isInteger(requestedLevel) || requestedLevel < 2 || requestedLevel > MAX_LEVEL) {
    return { ok: false, error: 'That isn’t a level you can ask for.' }
  }

  // Read the level from the database rather than the session: this is a write,
  // and it should compare against what is true now.
  const row = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { founderLevel: true },
  })
  const currentLevel = row?.founderLevel ?? 1
  if (requestedLevel <= currentLevel) {
    return { ok: false, error: 'You’re already at that level or higher.' }
  }

  try {
    const [created] = await db
      .insert(levelRequests)
      .values({ userId: user.id, requestedLevel, evidence })
      .returning({ id: levelRequests.id })
    if (!created) return { ok: false, error: 'We couldn’t save that. Try again.' }

    await track('level_requested', { requestedLevel }, { userId: user.id })
    return { ok: true, requestId: created.id }
  } catch (error) {
    // 23505 is the partial unique index doing its job. The index is the truth;
    // this branch only exists to turn it into a sentence. Checking first and
    // then inserting is the shape that races (PHASE-5-6-RETROSPECTIVE.md §4).
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: 'You’ve already got a request open. We’ll come back to you on that one first.',
      }
    }
    throw error
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

/** The founder's own exit from a pending request. Staff never mark something withdrawn. */
export async function withdrawLevelRequest(requestId: string): Promise<ActionResult> {
  const user = await requireUserOrThrow()

  const request = await db.query.levelRequests.findFirst({
    where: and(eq(levelRequests.id, requestId), eq(levelRequests.userId, user.id)),
  })
  // Scoped by userId in the query, so someone else's id reads as missing rather
  // than as forbidden — the row id alone is never proof of ownership.
  if (!request) return { ok: false, error: 'We couldn’t find that request.' }

  if (!isLegalTransition(request.status, 'withdrawn')) {
    return { ok: false, error: 'That request has already been decided.' }
  }

  await db
    .update(levelRequests)
    .set({ status: 'withdrawn', updatedAt: new Date() })
    .where(eq(levelRequests.id, requestId))

  return { ok: true }
}

export async function getOpenLevelRequest(userId: string) {
  return db.query.levelRequests.findFirst({
    where: and(eq(levelRequests.userId, userId), eq(levelRequests.status, 'pending')),
  })
}

export async function listLevelRequestsForUser(userId: string) {
  return db.query.levelRequests.findMany({
    where: eq(levelRequests.userId, userId),
    orderBy: [desc(levelRequests.createdAt)],
    limit: 10,
  })
}
