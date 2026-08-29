import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { db } from '@/db/client'
import { accounts, sessions, users, verificationTokens } from '@/db/schema'

const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)

export const authConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Database sessions, not JWT: a session can be revoked server-side the moment
  // a role changes or an account is disabled (spec §31).
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login', verifyRequest: '/verify', error: '/login' },
  // No Credentials provider: Auth.js forces JWT sessions when one is present,
  // and JWTs cannot be revoked server-side (spec §31). Password sign-in mints
  // the same database session directly — see src/server/auth/session.ts.
  providers: [...(googleEnabled ? [Google] : [])],
  callbacks: {
    /**
     * Roles are read from the database on every session read rather than baked
     * into a token, so revoking a staffRole takes effect on the next request.
     *
     * This returns an explicitly constructed object rather than spreading the
     * adapter's session. With the database strategy that session carries the
     * raw `sessionToken`, and returning it would publish the session secret
     * through /api/auth/session — readable by any script on the page, which
     * would defeat the httpOnly cookie it was issued in.
     */
    async session({ session, user }) {
      const row = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: {
          email: true,
          name: true,
          image: true,
          platformRole: true,
          staffRole: true,
          onboardingCompletedAt: true,
          journeyStage: true,
        },
      })

      return {
        expires: session.expires,
        user: {
          id: user.id,
          email: row?.email ?? user.email,
          name: row?.name ?? null,
          image: row?.image ?? null,
          platformRole: row?.platformRole ?? 'student',
          staffRole: row?.staffRole ?? null,
          onboardingComplete: row?.onboardingCompletedAt != null,
          journeyStage: row?.journeyStage ?? null,
        },
      }
    },
  },
} satisfies NextAuthConfig
