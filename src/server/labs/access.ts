import type { Infrastructure } from '@/payload/payload-types'

/**
 * Who may decide on a booking for a given space.
 *
 * A lab in the School of Biotechnology is run by a professor there. They are
 * not KNEST staff, they have no `staffRole`, and giving them one to let them
 * answer their own room's requests would hand them the applications queue and
 * the member directory as well. So authorisation here is per-entity — "do I
 * manage THIS space" — which is a different axis from the coarse global roles
 * and, per `PRODUCT_ARCHITECTURE.md`, the one that does not turn into a
 * proliferation of near-identical roles.
 *
 * `super_admin` is included because someone has to be able to unblock a lab
 * whose manager has left, and because the alternative is an escape hatch made
 * of SQL.
 *
 * Pure and dependency-free on purpose, so it can be unit-tested and so the
 * rule lives in one readable place rather than inline in three handlers.
 */

export type ManagerIdentity = {
  /** Optional because the session type makes it so; a manager with no email matches nothing. */
  email?: string | null
  staffRole?: string | null
}

export function managerEmails(space: Pick<Infrastructure, 'managers'>): string[] {
  return (space.managers ?? [])
    .map((manager) => manager?.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email))
}

export function canManageSpace(
  user: ManagerIdentity | null | undefined,
  space: Pick<Infrastructure, 'managers'> | null | undefined,
): boolean {
  if (!user || !space) return false
  if (user.staffRole === 'super_admin') return true

  const email = user.email?.trim().toLowerCase()
  if (!email) return false
  return managerEmails(space).includes(email)
}

/**
 * Whether this person sees the manager queue at all.
 *
 * A super admin manages every space, so asking "do you manage anything" by
 * listing the spaces that name them would answer no. That is the one case
 * where the question is about the role rather than the list.
 */
export function isAnySpaceManager(
  user: ManagerIdentity | null | undefined,
  spaces: readonly Pick<Infrastructure, 'managers'>[],
): boolean {
  if (!user) return false
  if (user.staffRole === 'super_admin') return true
  return spaces.some((space) => canManageSpace(user, space))
}
