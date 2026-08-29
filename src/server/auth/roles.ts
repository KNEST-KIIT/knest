import type { journeyStage, platformRole, staffRole } from '@/db/schema'

export type PlatformRole = (typeof platformRole.enumValues)[number]
export type StaffRole = (typeof staffRole.enumValues)[number]
export type JourneyStage = (typeof journeyStage.enumValues)[number]

/**
 * Which staff roles may reach which areas of /admin (spec §24).
 *
 * Deliberately coarse — V1 forbids a granular permission matrix. `super_admin`
 * is absent from these lists because it is checked separately and passes
 * everything.
 */
export const ADMIN_AREAS = {
  content: ['content_admin'],
  programs: ['program_manager'],
  applications: ['program_manager', 'reviewer'],
  startups: ['startup_manager'],
  mentors: ['mentor_manager'],
  users: [],
  settings: [],
} as const satisfies Record<string, readonly StaffRole[]>

export type AdminArea = keyof typeof ADMIN_AREAS

export function canAccessArea(role: StaffRole | null, area: AdminArea): boolean {
  if (!role) return false
  if (role === 'super_admin') return true
  return (ADMIN_AREAS[area] as readonly StaffRole[]).includes(role)
}

/** Any non-null staff role can load the admin shell; areas are gated separately. */
export function isStaff(role: StaffRole | null): role is StaffRole {
  return role !== null
}
