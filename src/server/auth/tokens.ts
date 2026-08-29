import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { verificationTokens } from '@/db/schema'

/**
 * Single-use tokens for email verification and password reset, built on the
 * same verification_tokens table Auth.js's adapter already defines — one
 * mechanism rather than a second bespoke token table.
 *
 * `purpose` is folded into the stored identifier (`verify-email:<email>` /
 * `reset-password:<email>`) so a verification token can never be replayed to
 * reset a password, even though both share the same underlying table.
 */

type Purpose = 'verify-email' | 'reset-password'

function scopedIdentifier(purpose: Purpose, email: string): string {
  return `${purpose}:${email}`
}

export async function issueToken(purpose: Purpose, email: string, ttlMs: number): Promise<string> {
  const identifier = scopedIdentifier(purpose, email)
  const token = randomBytes(32).toString('hex')

  // Replace any outstanding token for this purpose so requesting a new link
  // invalidates the old one rather than leaving two valid links in the wild.
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier))
  await db.insert(verificationTokens).values({ identifier, token, expires: new Date(Date.now() + ttlMs) })

  return token
}

/** Consumes the token if valid — it is deleted whether or not it matched, so it can never be reused. */
export async function consumeToken(purpose: Purpose, email: string, token: string): Promise<boolean> {
  const identifier = scopedIdentifier(purpose, email)

  const row = await db.query.verificationTokens.findFirst({
    where: and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)),
  })

  if (!row) return false
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier))

  return row.expires.getTime() > Date.now()
}
