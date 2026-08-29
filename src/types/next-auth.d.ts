import type { DefaultSession } from 'next-auth'
import type { JourneyStage, PlatformRole, StaffRole } from '@/server/auth/roles'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      platformRole: PlatformRole
      /** Null for non-staff. Non-null is what grants /admin access. */
      staffRole: StaffRole | null
      onboardingComplete: boolean
      journeyStage: JourneyStage | null
    } & DefaultSession['user']
  }
}
