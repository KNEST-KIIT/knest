'use server'

import { and, desc, eq, lt } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLogs, levelRequests, users } from '@/db/schema'
import { track } from '@/server/analytics/track'
import { requireAdminArea, requireStaffOrThrow } from '@/server/auth/guards'
import { levelDecisionTemplate } from '@/server/notifications/templates'
import { sendNotificationEmail, writeNotification } from '@/server/notifications/send'
import { levelDefinition } from './levels'
import { isLegalTransition } from './transitions'

export type ActionResult = { ok: true } | { ok: false; error: string }
type Decision = 'approved' | 'rejected'

export async function listLevelRequestsForReview(filters: { status?: string } = {}) {
  await requireAdminArea('levels')

  const rows = await db.query.levelRequests.findMany({
    where: filters.status
      ? eq(levelRequests.status, filters.status as 'pending')
      : undefined,
    with: { user: true },
    orderBy: [desc(levelRequests.createdAt)],
    limit: 200,
  })

  return rows
}

export async function getLevelRequestForReview(requestId: string) {
  await requireAdminArea('levels')
  return db.query.levelRequests.findFirst({
    where: eq(levelRequests.id, requestId),
    with: { user: true },
  })
}

/**
 * The staff decision, and the only thing in the app that moves
 * `users.founderLevel`.
 *
 * Shaped exactly like `changeApplicationStatus`: guard, load, legality check,
 * then one transaction carrying the status change, the level grant, the audit
 * row and the notification's database write together. A crash between any two
 * of those would otherwise leave a founder levelled up with no audit trail, or
 * a decision recorded that never reached them. The email goes after the commit
 * because it cannot be rolled back.
 */
export async function decideLevelRequest(
  requestId: string,
  decision: Decision,
  note?: string,
): Promise<ActionResult> {
  // Throws rather than notFound(): this is called from a route handler, which
  // needs a JSON 403, not an empty-bodied 404 (PHASE-7-9-RETROSPECTIVE.md).
  const staff = await requireStaffOrThrow('levels')

  const request = await db.query.levelRequests.findFirst({
    where: eq(levelRequests.id, requestId),
  })
  if (!request) return { ok: false, error: 'We couldn’t find that request.' }

  if (!isLegalTransition(request.status, decision)) {
    return {
      ok: false,
      error: `Can’t move a request from ${request.status} to ${decision}.`,
    }
  }

  const approved = decision === 'approved'
  const level = levelDefinition(request.requestedLevel)
  const email = levelDecisionTemplate(approved, level.label, note?.trim() || null)

  const notifyInput = {
    userId: request.userId,
    type: 'level_decision' as const,
    title: approved ? `You're now at level ${level.label}` : 'An update on your level request',
    // The decision note is shown to the founder, unlike an application's
    // internal note. A refused level with no reason attached is the kind of
    // silence that makes a ladder feel arbitrary.
    body: note?.trim() || email.text,
    href: '/dashboard/level',
    email,
  }

  const decidedAt = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(levelRequests)
      .set({
        status: decision,
        decidedByUserId: staff.id,
        decidedAt,
        decisionNote: note?.trim() || null,
        updatedAt: decidedAt,
      })
      .where(eq(levelRequests.id, requestId))

    if (approved) {
      // `lt` guards against a stale request lowering someone who has already
      // been moved up another way, and makes a double-approve a no-op rather
      // than a second grant.
      await tx
        .update(users)
        .set({
          founderLevel: request.requestedLevel,
          founderLevelGrantedAt: decidedAt,
          updatedAt: decidedAt,
        })
        .where(and(eq(users.id, request.userId), lt(users.founderLevel, request.requestedLevel)))
    }

    await tx.insert(auditLogs).values({
      actorUserId: staff.id,
      action: 'level_request_decided',
      entityType: 'level_request',
      entityId: requestId,
      before: { status: request.status },
      after: { status: decision, grantedLevel: approved ? request.requestedLevel : null },
    })

    await writeNotification(tx, notifyInput)
  })

  await sendNotificationEmail(request.userId, notifyInput.email)
  if (approved) {
    await track(
      'level_granted',
      { level: request.requestedLevel },
      { userId: request.userId },
    )
  }

  return { ok: true }
}
