import { notFound, redirect } from 'next/navigation'
import type { Session } from 'next-auth'
import { auth } from './index'
import { canAccessArea, type AdminArea, type PlatformRole, type StaffRole } from './roles'

export type SessionUser = Session['user']

/**
 * The §31 enforcement point.
 *
 * Every server action, route handler and protected page calls one of these as
 * its FIRST statement. Role checks inside components decide what to render and
 * are never the thing that keeps anyone out — a hidden button is not access
 * control.
 */

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  return session?.user ?? null
}

/** Requires any signed-in user. Redirects to login, preserving the destination. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login'
    redirect(target)
  }
  return user
}

/**
 * Requires a signed-in user who has finished onboarding. Someone who signed up
 * but bailed halfway is sent back to finish rather than into a dashboard that
 * has nothing to personalise itself with (spec §09).
 */
export async function requireOnboardedUser(returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(returnTo)
  if (!user.onboardingComplete) redirect('/onboarding')
  return user
}

export async function requirePlatformRole(
  ...roles: readonly PlatformRole[]
): Promise<SessionUser> {
  const user = await requireUser()
  if (!roles.includes(user.platformRole)) notFound()
  return user
}

/**
 * Requires staff. Responds with 404, not 403: confirming that /admin exists
 * tells an attacker where to point their effort.
 */
export async function requireStaff(): Promise<SessionUser & { staffRole: StaffRole }> {
  const user = await getSessionUser()
  if (!user?.staffRole) notFound()
  return user as SessionUser & { staffRole: StaffRole }
}

export async function requireAdminArea(
  area: AdminArea,
): Promise<SessionUser & { staffRole: StaffRole }> {
  const user = await requireStaff()
  if (!canAccessArea(user.staffRole, area)) notFound()
  return user
}

/**
 * For route handlers and server actions, which need a value back rather than a
 * redirect. Throws `UnauthorizedError`, caught at the API boundary.
 */
export class UnauthorizedError extends Error {
  constructor(readonly status: 401 | 403 = 401) {
    super(status === 401 ? 'Not signed in' : 'Not permitted')
    this.name = 'UnauthorizedError'
  }
}

export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError(401)
  return user
}

export async function requireStaffOrThrow(
  area?: AdminArea,
): Promise<SessionUser & { staffRole: StaffRole }> {
  const user = await requireUserOrThrow()
  if (!user.staffRole) throw new UnauthorizedError(403)
  if (area && !canAccessArea(user.staffRole, area)) throw new UnauthorizedError(403)
  return user as SessionUser & { staffRole: StaffRole }
}
