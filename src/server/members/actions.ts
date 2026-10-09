import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLogs, sessions, users } from '@/db/schema'
import { requireStaffOrThrow } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'
import { staffRole as staffRoleEnum } from '@/db/schema'

export type MemberResult = { ok: true } | { ok: false; error: string }

export const ASSIGNABLE_STAFF_ROLES = staffRoleEnum.enumValues

/** True if `value` is a staff role the database accepts, or null (which clears staff access). */
export function isStaffRoleOrNull(value: unknown): value is StaffRole | null {
  return value === null || (typeof value === 'string' && (ASSIGNABLE_STAFF_ROLES as readonly string[]).includes(value))
}

/** How many ACTIVE super admins exist, optionally ignoring one user. */
async function otherActiveSuperAdmins(exceptUserId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.staffRole, 'super_admin'), eq(users.isActive, true), ne(users.id, exceptUserId)))
  return rows[0]?.n ?? 0
}

/**
 * Deactivates or reactivates an account (KN-10). Super admin only.
 *
 * Deactivating deletes every session row in the same transaction, so the person
 * is signed out on their next request, and the change is audited. The session
 * lookup also refuses inactive users on its own (active-only-adapter.ts), so
 * even a session created concurrently cannot survive.
 */
export async function setMemberActive(userId: string, isActive: boolean): Promise<MemberResult> {
  const actor = await requireStaffOrThrow('users') // 'users' is super_admin only
  if (userId === actor.id) return { ok: false, error: 'You can’t change your own account here.' }

  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, isActive: true, staffRole: true },
  })
  if (!target) return { ok: false, error: 'We couldn’t find that account.' }

  if (!isActive && target.staffRole === 'super_admin' && (await otherActiveSuperAdmins(userId)) === 0) {
    return { ok: false, error: 'That is the last active super admin. Add another before deactivating this one.' }
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId))
    if (!isActive) await tx.delete(sessions).where(eq(sessions.userId, userId))
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

/**
 * Grants, changes or removes a person's staff role (KN-10). Super admin only.
 *
 * Every change revokes that person's sessions in the same transaction, so a
 * demotion cannot be outlived by a session that was minted under the old role,
 * and it is audited. Nobody can change their own role, and the last active super
 * admin cannot be removed or demoted (it would lock everyone out of the console).
 */
export async function setStaffRole(userId: string, role: StaffRole | null): Promise<MemberResult> {
  const actor = await requireStaffOrThrow('users')
  if (userId === actor.id) return { ok: false, error: 'You can’t change your own staff role.' }

  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, staffRole: true },
  })
  if (!target) return { ok: false, error: 'We couldn’t find that account.' }
  if (target.staffRole === role) return { ok: true }

  if (target.staffRole === 'super_admin' && role !== 'super_admin' && (await otherActiveSuperAdmins(userId)) === 0) {
    return { ok: false, error: 'That is the last active super admin. Add another before changing this role.' }
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ staffRole: role, updatedAt: new Date() }).where(eq(users.id, userId))
    await tx.delete(sessions).where(eq(sessions.userId, userId))
    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: 'staff_role_changed',
      entityType: 'user',
      entityId: userId,
      before: { staffRole: target.staffRole },
      after: { staffRole: role },
    })
  })
  return { ok: true }
}
