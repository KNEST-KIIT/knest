import type { StaffRole } from './roles'

const STAFF_HOME: Record<StaffRole, string> = {
  super_admin: '/admin/overview', reviewer: '/admin/applications', program_manager: '/admin/applications',
  content_admin: '/admin', startup_manager: '/admin/collections/startups',
  mentor_manager: '/admin/collections/mentors', lab_admin: '/admin/overview',
}

export function signInDestination(user: { staffRole?: StaffRole | null; onboardingComplete: boolean }) {
  if (user.staffRole) return STAFF_HOME[user.staffRole]
  return user.onboardingComplete ? '/dashboard' : '/onboarding'
}
