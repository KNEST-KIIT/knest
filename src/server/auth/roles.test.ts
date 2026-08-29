import { describe, expect, it } from 'vitest'
import { ADMIN_AREAS, canAccessArea, isStaff, type AdminArea, type StaffRole } from './roles'

const ALL_AREAS = Object.keys(ADMIN_AREAS) as AdminArea[]
const NON_SUPER_ROLES: StaffRole[] = [
  'reviewer',
  'content_admin',
  'program_manager',
  'startup_manager',
  'mentor_manager',
]

describe('canAccessArea', () => {
  it('refuses every area when there is no staff role', () => {
    for (const area of ALL_AREAS) {
      expect(canAccessArea(null, area)).toBe(false)
    }
  })

  it('allows super_admin everywhere', () => {
    for (const area of ALL_AREAS) {
      expect(canAccessArea('super_admin', area)).toBe(true)
    }
  })

  it('confines each staff role to its declared areas', () => {
    for (const role of NON_SUPER_ROLES) {
      for (const area of ALL_AREAS) {
        const expected = (ADMIN_AREAS[area] as readonly StaffRole[]).includes(role)
        expect(canAccessArea(role, area)).toBe(expected)
      }
    }
  })

  it('reserves users and settings for super_admin alone', () => {
    for (const role of NON_SUPER_ROLES) {
      expect(canAccessArea(role, 'users')).toBe(false)
      expect(canAccessArea(role, 'settings')).toBe(false)
    }
  })

  it('lets a reviewer into applications but not programs', () => {
    expect(canAccessArea('reviewer', 'applications')).toBe(true)
    expect(canAccessArea('reviewer', 'programs')).toBe(false)
  })
})

describe('isStaff', () => {
  it('treats a null role as non-staff and any role as staff', () => {
    expect(isStaff(null)).toBe(false)
    for (const role of [...NON_SUPER_ROLES, 'super_admin' as const]) {
      expect(isStaff(role)).toBe(true)
    }
  })
})
