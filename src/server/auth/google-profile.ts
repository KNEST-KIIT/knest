import { emailSchema } from './validation'

/** Identity claims only. Google is never a source of KNEST permissions. */
export function verifiedGoogleEmail(profile: { email?: unknown; email_verified?: unknown; sub?: unknown } | undefined): string | null {
  if (profile?.email_verified !== true || typeof profile.sub !== 'string' || !profile.sub) return null
  const email = emailSchema.safeParse(profile.email)
  return email.success ? email.data : null
}
