import { createHash, randomBytes } from 'node:crypto'
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
 *
 * Only a SHA-256 digest of the token is stored. The token itself exists in the
 * e-mailed link and nowhere else, so a copy of the table (a backup, a SQL
 * injection, a curious operator) does not yield working reset links. A random
 * 256-bit token needs no salt or slow hash; the digest is enough.
 */

type Purpose = 'verify-email' | 'reset-password'

function scopedIdentifier(purpose: Purpose, email: string): string {
  return `${purpose}:${email}`
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export async function issueToken(purpose: Purpose, email: string, ttlMs: number): Promise<string> {
  const identifier = scopedIdentifier(purpose, email)
  const token = randomBytes(32).toString('hex')

  // Replace any outstanding token for this purpose so requesting a new link
  // invalidates the old one rather than leaving two valid links in the wild.
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier))
  await db
    .insert(verificationTokens)
    .values({ identifier, token: hashToken(token), expires: new Date(Date.now() + ttlMs) })

  return token
}

/**
 * Consumes the token if it matches and has not expired. Deleting the row is the
 * check: of two simultaneous requests carrying the same link, exactly one gets
 * the row back and the other gets nothing, so a link cannot be used twice.
 */
export async function consumeToken(purpose: Purpose, email: string, token: string): Promise<boolean> {
  const identifier = scopedIdentifier(purpose, email)

  const [row] = await db
    .delete(verificationTokens)
    .where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, hashToken(token))))
    .returning({ expires: verificationTokens.expires })

  return Boolean(row) && row!.expires.getTime() > Date.now()
}
