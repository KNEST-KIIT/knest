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

/** Matches Auth.js v5's own cookie naming, including the __Secure- prefix. */
export function sessionCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'
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
