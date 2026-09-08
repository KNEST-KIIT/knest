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
      /**
       * What KNEST has verified, 1–7. Separate from `journeyStage`, which is
       * what the person told us. Re-read from the database on every session
       * read like `staffRole`, so a granted level takes effect on the next
       * request rather than when a token expires.
       */
      founderLevel: number
    } & DefaultSession['user']
  }
}
