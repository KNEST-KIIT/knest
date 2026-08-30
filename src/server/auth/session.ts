import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { sessions } from '@/db/schema'

/**
 * Password sign-in, issued as a DATABASE session.
 *
 * Auth.js v5 refuses to pair its Credentials provider with the `database`
 * session strategy — credentials there force JWTs. JWTs cannot be revoked
 * server-side: a demoted admin would keep their access until the token expired,
 * which defeats the §31 guarantee that authorization is enforced on the server
 * on every request.
 *
 * So password logins skip the Credentials provider and mint the same session
 * row Auth.js creates for OAuth and email sign-ins. `auth()` then reads it
 * through the normal adapter path — one session mechanism for every provider,
 * and deleting the row logs the user out instantly.
 */

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/**
 * Matches Auth.js v5's own cookie naming, including the __Secure- prefix.
 *
 * Auth.js decides useSecureCookies from AUTH_URL's protocol when AUTH_URL
 * is set (@auth/core's createActionURL — verified by reading its source:
 * `config.useSecureCookies ?? url.protocol === "https:"`, and `url` there
 * comes from AUTH_URL/NEXTAUTH_URL first), NOT from NODE_ENV. Deciding by
 * NODE_ENV alone — the previous version of this function — diverges from
 * that the moment AUTH_URL is an http:// URL in a production build (this
 * repo's own .env.example sets exactly that for local use), which sets a
 * cookie auth() then can never find: login silently breaks. Verified live
 * by running a real `pnpm build && pnpm start` and signing in — auth()
 * returned null until this matched Auth.js's own signal.
 */
export function sessionCookieName(): string {
  const envUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  const secure = envUrl ? envUrl.startsWith('https://') : process.env.NODE_ENV === 'production'
  return secure ? '__Secure-authjs.session-token' : 'authjs.session-token'
}

export async function createDatabaseSession(userId: string): Promise<void> {
  const sessionToken = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)

  await db.insert(sessions).values({ sessionToken, userId, expires })

  const store = await cookies()
  store.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires,
  })
}

/** Deletes the row as well as the cookie, so the session is dead server-side. */
export async function destroyDatabaseSession(): Promise<void> {
  const store = await cookies()
  const name = sessionCookieName()
  const token = store.get(name)?.value

  if (token) await db.delete(sessions).where(eq(sessions.sessionToken, token))
  store.delete(name)
}

/** Revokes every session for a user — used when disabling an account or demoting staff. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}
