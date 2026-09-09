'use server'

import { and, count, desc, eq, ilike, isNotNull, or, type SQL } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  applications,
  auditLogs,
  eventRegistrations,
  labBookings,
  levelRequests,
  users,
} from '@/db/schema'
import { requireAdminArea, requireStaffOrThrow } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'

/**
 * Reading and administering the people on the platform.
 *
 * Before this there was no screen anywhere that listed members. `app.users` had
 * indexes on `platform_role` and `staff_role` that nothing queried, and
 * `ADMIN_AREAS.users` was declared with no screen behind it. More pointedly,
 * `staffRole` had no write path in the entire application: a new staff member
 * could only be created with direct SQL against production, which is not a
 * thing anyone should have to do to onboard a colleague.
 */

export type MemberFilters = {
  q?: string
  platformRole?: string
  staffOnly?: boolean
  level?: number
  page?: number
}

/**
 * Deliberately modest. The applications list has no limit at all and degrades
 * as it grows.
 *
 * Not exported: this file is `'use server'`, where every export becomes a
 * callable server action, so only async functions may leave it.
 */
const MEMBERS_PER_PAGE = 25

function buildWhere(filters: MemberFilters): SQL | undefined {
  const clauses: SQL[] = []

  if (filters.q) {
    const term = `%${filters.q}%`
    // Name is nullable, so an OR across both is what actually finds people.
    const match = or(ilike(users.email, term), ilike(users.name, term))
    if (match) clauses.push(match)
  }
  if (filters.platformRole) {
    clauses.push(eq(users.platformRole, filters.platformRole as 'student'))
  }
  if (filters.staffOnly) {
    clauses.push(isNotNull(users.staffRole))
  }
  if (filters.level) {
    clauses.push(eq(users.founderLevel, filters.level))
  }

  if (clauses.length === 0) return undefined
  return clauses.length === 1 ? clauses[0] : and(...clauses)
}

export async function listMembers(filters: MemberFilters = {}) {
  await requireAdminArea('users')

  const page = Math.max(1, Math.trunc(filters.page ?? 1))
  const where = buildWhere(filters)

  const [rows, [total]] = await Promise.all([
    db.query.users.findMany({
      where,
      columns: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        staffRole: true,
        journeyStage: true,
        founderLevel: true,
        isActive: true,
        createdAt: true,
        onboardingCompletedAt: true,
      },
      orderBy: [desc(users.createdAt)],
      limit: MEMBERS_PER_PAGE,
      offset: (page - 1) * MEMBERS_PER_PAGE,
    }),
    db.select({ value: count() }).from(users).where(where),
  ])

  const totalCount = total?.value ?? 0
  return {
    rows,
    page,
    total: totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / MEMBERS_PER_PAGE)),
  }
}

/**
 * Everything about one person in one place.
 *
 * The application detail screen already fetched the full user row and rendered
 * only their name and email — stage, school, goals and history were all loaded
 * and thrown away. This is the screen that was missing.
 */
export async function getMemberDetail(userId: string) {
  await requireAdminArea('users')

  const member = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!member) return null

  const [memberApplications, registrations, levels, bookings, actions] = await Promise.all([
    db.query.applications.findMany({
      where: eq(applications.userId, userId),
      orderBy: [desc(applications.createdAt)],
      limit: 20,
    }),
    db.query.eventRegistrations.findMany({
      where: eq(eventRegistrations.userId, userId),
      orderBy: [desc(eventRegistrations.registeredAt)],
      limit: 20,
    }),
    db.query.levelRequests.findMany({
      where: eq(levelRequests.userId, userId),
      orderBy: [desc(levelRequests.createdAt)],
      limit: 20,
    }),
    db.query.labBookings.findMany({
      where: eq(labBookings.userId, userId),
      orderBy: [desc(labBookings.startsAt)],
      limit: 20,
    }),
    // What staff have done TO this account — the audit log had no reader at all
    // before this, despite being written on every decision.
    db.query.auditLogs.findMany({
      where: eq(auditLogs.entityId, userId),
      orderBy: [desc(auditLogs.createdAt)],
      limit: 20,
    }),
  ])

  return { member, applications: memberApplications, registrations, levels, bookings, actions }
}

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Granting and revoking staff access.
 *
 * `super_admin` only, and not by accident: this is the one action in the
 * product that can create another person who can perform it. Anyone able to
 * set staff roles can make themselves anything, so the gate is the highest one
 * available rather than the `users` area that merely reads the directory.
 */
export async function setStaffRole(userId: string, staffRole: StaffRole | null): Promise<ActionResult> {
  const actor = await requireStaffOrThrow()
  if (actor.staffRole !== 'super_admin') {
    return { ok: false, error: 'Only a super admin can change staff access.' }
  }
  if (userId === actor.id) {
    // Removing your own last super_admin would lock the console permanently,
    // and there is no other way in. Refuse the whole class rather than trying
    // to count remaining admins in a race-prone way.
    return { ok: false, error: 'You can’t change your own staff access.' }
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, staffRole: true },
  })
  if (!target) return { ok: false, error: 'We couldn’t find that account.' }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ staffRole, updatedAt: new Date() })
      .where(eq(users.id, userId))

    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: staffRole ? 'staff_role_granted' : 'staff_role_revoked',
      entityType: 'user',
      entityId: userId,
      before: { staffRole: target.staffRole },
      after: { staffRole },
    })
  })

  return { ok: true }
}

/**
 * Deactivating an account.
 *
 * `users.isActive` was read by the auth strategy and written by nothing, so a
 * compromised or departed account could only be dealt with in SQL. Sessions are
 * database-backed and roles are re-read on every request, so this takes effect
 * on the account's next request rather than when a token expires.
 */
export async function setMemberActive(userId: string, isActive: boolean): Promise<ActionResult> {
  const actor = await requireStaffOrThrow()
  if (actor.staffRole !== 'super_admin') {
    return { ok: false, error: 'Only a super admin can deactivate an account.' }
  }
  if (userId === actor.id) return { ok: false, error: 'You can’t deactivate your own account.' }

  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, isActive: true },
  })
  if (!target) return { ok: false, error: 'We couldn’t find that account.' }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId))
    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: isActive ? 'account_reactivated' : 'account_deactivated',
      entityType: 'user',
      entityId: userId,
      before: { isActive: target.isActive },
      after: { isActive },
    })
  })

  return { ok: true }
}
