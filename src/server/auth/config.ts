import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { and, eq } from 'drizzle-orm'
import type { NextAuthConfig } from 'next-auth'
import { db } from '@/db/client'
import { activeOnly } from './active-only-adapter'
import { authProviders } from './providers'
import { accounts, sessions, users, verificationTokens } from '@/db/schema'
import { verifiedGoogleEmail } from './google-profile'
import { consumeGoogleLinkGrant, currentLinkSession } from './google-link'
import { emailSchema } from './validation'

export const authConfig = {
  // A deactivated account (or one whose row is gone) cannot hold a session: see
  // active-only-adapter.ts (KN-10).
  adapter: activeOnly(
    DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    async (userId) => {
      const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { isActive: true } })
      return row?.isActive === true
    },
  ),
  // Database sessions, not JWT: a session can be revoked server-side the moment
  // a role changes or an account is disabled (spec §31).
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login', verifyRequest: '/verify', error: '/login' },
  // No Credentials provider: Auth.js forces JWT sessions when one is present,
  // and JWTs cannot be revoked server-side (spec §31). Password sign-in mints
  // the same database session directly — see src/server/auth/session.ts.
  providers: authProviders(),
  callbacks: {
    /** Google sign-in must not bypass deactivation (password login already refuses it). */
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return false
      const email = verifiedGoogleEmail(profile)
      if (!email || profile?.sub !== account.providerAccountId) return false
      const linked = await db.query.accounts.findFirst({
        where: and(eq(accounts.provider, 'google'), eq(accounts.providerAccountId, account.providerAccountId)),
        columns: { userId: true },
      })
      const row = await db.query.users.findFirst({
        where: linked ? eq(users.id, linked.userId) : eq(users.email, email),
        columns: { id: true, isActive: true },
      })
      if (row && !row.isActive) return false
      const current = await currentLinkSession()
      if (current) {
        // Auth.js otherwise automatically links any new Google identity to a live
        // session. Require explicit password proof and the SAME verified address.
        if (linked) return linked.userId === current.id
        if (email !== current.email || !(await consumeGoogleLinkGrant(current.token))) {
          return '/dashboard/account?error=GoogleLinkRequired'
        }
      }
      // Signed-out email collisions remain Auth.js OAuthAccountNotLinked, never a merge.
      return Boolean(user.email)
    },
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
  events: {
    async linkAccount({ user, account, profile }) {
      if (account.provider !== 'google' || !user.id) return
      // Auth.js passes the mapped profile to this event, after the signIn
      // callback has checked Google's raw email_verified and subject claims.
      const email = emailSchema.safeParse(profile.email)
      if (email.success) await db.update(users).set({ emailVerified: new Date(), updatedAt: new Date() })
        .where(and(eq(users.id, user.id), eq(users.email, email.data)))
    },
  },
} satisfies NextAuthConfig
