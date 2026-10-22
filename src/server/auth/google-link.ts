import { cookies } from 'next/headers'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/db/client'
import { sessions, users } from '@/db/schema'
import { consumeToken, hashToken, issueToken } from './tokens'
import { sessionCookieName } from './session'

const TTL_SECONDS = 10 * 60
const grantCookieName = () => sessionCookieName().startsWith('__Secure-') ? '__Secure-knest.google-link' : 'knest.google-link'

/** Read the database session without recursively calling auth() inside an Auth.js callback. */
export async function currentLinkSession() {
  const token = (await cookies()).get(sessionCookieName())?.value
  if (!token) return null
  const [row] = await db.select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.sessionToken, token), gt(sessions.expires, new Date()), eq(users.isActive, true)))
  return row ? { ...row, token } : null
}

/** A short-lived, single-use proof tied to this exact signed-in session. */
export async function issueGoogleLinkGrant(sessionToken: string) {
  const grant = await issueToken('link-google', hashToken(sessionToken), TTL_SECONDS * 1000)
  ;(await cookies()).set(grantCookieName(), grant, {
    httpOnly: true, sameSite: 'lax', secure: grantCookieName().startsWith('__Secure-'), path: '/', maxAge: TTL_SECONDS,
  })
}

export async function consumeGoogleLinkGrant(sessionToken: string) {
  const grant = (await cookies()).get(grantCookieName())?.value
  return Boolean(grant) && consumeToken('link-google', hashToken(sessionToken), grant!)
}
