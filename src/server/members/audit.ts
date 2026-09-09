'use server'

import { and, desc, eq, inArray, type SQL } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLogs, users } from '@/db/schema'
import { requireAdminArea } from '@/server/auth/guards'

/**
 * Reading the audit log.
 *
 * `app.audit_logs` was written on every staff decision and read in exactly
 * zero places — `audit_logs_entity_idx` was queried by nothing. A log nobody
 * can read is a log that cannot answer the one question it exists for: who
 * changed this, and when. Deactivating an account, granting staff access and
 * deciding a level all write here, so this is also the only place those become
 * reviewable.
 *
 * `users` rather than `applications`, because who did what to whom is a
 * question about people. Gated on the `users` area — super admin only — for
 * the same reason: the log names the actor of every decision, which is more
 * than a reviewer needs to do their own job.
 */

const PER_PAGE = 50

export type AuditFilters = { action?: string; entityType?: string; page?: number }

export async function listAuditLog(filters: AuditFilters = {}) {
  await requireAdminArea('users')

  const page = Math.max(1, Math.trunc(filters.page ?? 1))
  const clauses: SQL[] = []
  if (filters.action) clauses.push(eq(auditLogs.action, filters.action))
  if (filters.entityType) clauses.push(eq(auditLogs.entityType, filters.entityType))
  const where = clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : and(...clauses)

  const rows = await db.query.auditLogs.findMany({
    where,
    orderBy: [desc(auditLogs.createdAt)],
    limit: PER_PAGE + 1,
    offset: (page - 1) * PER_PAGE,
  })

  // The log stores an actor id, not a name. One batched lookup, so a page of
  // fifty entries is two queries rather than fifty-one.
  const actorIds = [...new Set(rows.map((row) => row.actorUserId))]
  const actors = actorIds.length
    ? await db.query.users.findMany({
        where: inArray(users.id, actorIds),
        columns: { id: true, name: true, email: true },
      })
    : []
  const actorById = new Map(actors.map((actor) => [actor.id, actor]))

  return {
    // The extra row is fetched only to answer "is there another page", then
    // dropped — cheaper than a second COUNT over a table that only grows.
    rows: rows.slice(0, PER_PAGE).map((row) => ({ entry: row, actor: actorById.get(row.actorUserId) ?? null })),
    page,
    hasMore: rows.length > PER_PAGE,
  }
}

/** The distinct actions actually recorded, so the filter offers real options. */
export async function listAuditActions(): Promise<string[]> {
  await requireAdminArea('users')
  const rows = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .orderBy(auditLogs.action)
    .limit(50)
  return rows.map((row) => row.action)
}
