import { count, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { applications, auditLogs, enquiries, users } from '@/db/schema'
import { canAccessArea, type StaffRole } from '@/server/auth/roles'

export type Overview = {
  /** Present only for the areas this role may see; the rest are left out, not zeroed. */
  applicationsAwaitingReview?: number
  applicationsInProgress?: number
  newEnquiries?: number
  activeMembers?: number
  inactiveMembers?: number
  recentActions?: { id: string; action: string; entityType: string; createdAt: Date; actorEmail: string }[]
}

/** What a staff member's landing page shows. Each figure is a real count and appears only if the role may open the screen behind it. */
export async function getOverview(role: StaffRole): Promise<Overview> {
  const out: Overview = {}

  if (canAccessArea(role, 'applications')) {
    const [awaiting] = await db.select({ value: count() }).from(applications).where(eq(applications.status, 'submitted'))
    const [inProgress] = await db
      .select({ value: count() })
      .from(applications)
      .where(inArray(applications.status, ['under_review', 'shortlisted', 'interview', 'waitlisted']))
    out.applicationsAwaitingReview = awaiting?.value ?? 0
    out.applicationsInProgress = inProgress?.value ?? 0
  }

  if (canAccessArea(role, 'enquiries')) {
    const [open] = await db.select({ value: count() }).from(enquiries).where(eq(enquiries.status, 'new'))
    out.newEnquiries = open?.value ?? 0
  }

  if (canAccessArea(role, 'users')) {
    const [active] = await db.select({ value: count() }).from(users).where(eq(users.isActive, true))
    const [inactive] = await db.select({ value: count() }).from(users).where(eq(users.isActive, false))
    out.activeMembers = active?.value ?? 0
    out.inactiveMembers = inactive?.value ?? 0
  }

  if (canAccessArea(role, 'audit')) {
    out.recentActions = await db
      .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, createdAt: auditLogs.createdAt, actorEmail: users.email })
      .from(auditLogs)
      .innerJoin(users, eq(users.id, auditLogs.actorUserId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(5)
  }

  return out
}
