import { and, count, desc, eq, ilike, isNotNull, or } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { likePattern } from '@/lib/pagination'
import { requireAdminArea } from '@/server/auth/guards'

export const MEMBERS_PAGE_SIZE = 25

/**
 * Accounts for the members screen (super admin only). Deliberately a short list of columns: enough
 * to find a person and act on their account, none of the profile text.
 */
export async function listMembers(filters: { q?: string; staffOnly?: boolean; inactiveOnly?: boolean; page?: number }) {
  await requireAdminArea('users')
  const conditions = []
  const q = filters.q?.trim()
  if (q) conditions.push(or(ilike(users.email, likePattern(q)), ilike(users.name, likePattern(q))))
  if (filters.staffOnly) conditions.push(isNotNull(users.staffRole))
  if (filters.inactiveOnly) conditions.push(eq(users.isActive, false))
  const where = conditions.length ? and(...conditions) : undefined
  const page = Math.max(1, filters.page ?? 1)

  const [total] = await db.select({ value: count() }).from(users).where(where)
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      platformRole: users.platformRole,
      staffRole: users.staffRole,
      isActive: users.isActive,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(MEMBERS_PAGE_SIZE)
    .offset((page - 1) * MEMBERS_PAGE_SIZE)

  return { rows, total: total?.value ?? 0, page }
}
