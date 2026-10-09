import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLogs, users } from '@/db/schema'
import { requireAdminArea } from '@/server/auth/guards'

export const AUDIT_PAGE_SIZE = 50

/**
 * The staff audit trail, newest first, for the audit viewer (super admin only). Every privileged
 * action writes a row in the same transaction as the change, so what is listed here is what
 * happened, not what someone remembered to record.
 */
export async function listAuditLogs(filters: { action?: string; entityType?: string; page?: number }) {
  await requireAdminArea('audit')
  const conditions = []
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action))
  if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType))
  const where = conditions.length ? and(...conditions) : undefined
  const page = Math.max(1, filters.page ?? 1)

  const [total] = await db.select({ value: count() }).from(auditLogs).where(where)
  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      before: auditLogs.before,
      after: auditLogs.after,
      actorEmail: users.email,
      actorName: users.name,
    })
    .from(auditLogs)
    .innerJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(AUDIT_PAGE_SIZE)
    .offset((page - 1) * AUDIT_PAGE_SIZE)

  return { rows, total: total?.value ?? 0, page }
}

/** The distinct actions and entity types on record, for the filter lists. */
export async function listAuditFacets() {
  await requireAdminArea('audit')
  const [actions, entityTypes] = await Promise.all([
    db.selectDistinct({ value: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action),
    db.selectDistinct({ value: auditLogs.entityType }).from(auditLogs).orderBy(auditLogs.entityType),
  ])
  return { actions: actions.map((a) => a.value), entityTypes: entityTypes.map((e) => e.value) }
}
