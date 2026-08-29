'use server'

import { compare, hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { resetPasswordTemplate, verifyEmailTemplate } from '@/server/email/templates'
import { sendEmail } from '@/server/email/send'
import { consumeToken, issueToken } from './tokens'
import { createDatabaseSession, destroyDatabaseSession, revokeAllSessions } from './session'
import { credentialsSchema, emailSchema, passwordSchema, signupSchema } from './validation'

export type AuthResult = { ok: true } | { ok: false; error: string }

/** Timing-equalising comparison target for accounts that do not exist. */
const DUMMY_HASH = '$2b$12$0000000000000000000000000000000000000000000000000000'

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000
const RESET_TTL_MS = 60 * 60 * 1000

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function loginWithPassword(input: unknown): Promise<AuthResult> {
  const parsed = credentialsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Enter your email and password.' }

  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })

  // Always run a bcrypt comparison, even with no matching account, so response
  // time does not reveal which email addresses are registered.
  const matches = await compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH)

  if (!user || !user.passwordHash || !matches || !user.isActive) {
    return { ok: false, error: 'That email and password don’t match.' }
  }

  await createDatabaseSession(user.id)
  return { ok: true }
}

/**
 * Signup issues a session immediately. Verification is asynchronous and does
 * not block it — requiring a completed email round-trip before someone can so
 * much as start onboarding is exactly the friction that loses a curious
 * visitor at the moment they were most willing (USER_JOURNEYS.md, Journey 1).
 * Verification is enforced later, only where identity actually matters:
 * submitting an application (Journey 2).
 */
export async function signUpWithPassword(input: unknown): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your details.' }
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })
  if (existing) {
    // Deliberately vague: confirming the address is taken would let anyone
    // enumerate who has a KNEST account.
    return { ok: false, error: 'That email can’t be used to sign up.' }
  }

  const [created] = await db
    .insert(users)
    .values({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await hash(parsed.data.password, 12),
      platformRole: 'student',
    })
    .returning({ id: users.id, email: users.email })

  if (!created) return { ok: false, error: 'We couldn’t create that account.' }

  await createDatabaseSession(created.id)
  await sendVerificationEmail(created.email).catch((error) => {
    // Signup already succeeded and the session is live; a mail-send failure
    // here must not fail the whole request. The person can request the link
    // again from /verify.
    console.error('Failed to send verification email:', error)
  })

  return { ok: true }
}

export async function logout(): Promise<void> {
  await destroyDatabaseSession()
}

export async function sendVerificationEmail(emailInput: string): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success) return { ok: false, error: 'That doesn’t look like an email address.' }

  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data) })
  // Same response whether or not the account exists — this endpoint is
  // reachable while signed out (a "resend" link on /verify), so it must not
  // become a way to check which emails have accounts.
  if (!user || user.emailVerified) return { ok: true }

  const token = await issueToken('verify-email', parsed.data, VERIFY_TTL_MS)
  const link = `${siteUrl()}/verify/confirm?email=${encodeURIComponent(parsed.data)}&token=${token}`
  const { subject, text } = verifyEmailTemplate(link)
  await sendEmail({ to: parsed.data, subject, text })

  return { ok: true }
}

export async function confirmEmailVerification(emailInput: string, token: string): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success || !token) return { ok: false, error: 'That link is invalid.' }

  const valid = await consumeToken('verify-email', parsed.data, token)
  if (!valid) return { ok: false, error: 'That link has expired. Request a new one.' }

  await db.update(users).set({ emailVerified: new Date(), updatedAt: new Date() }).where(eq(users.email, parsed.data))
  return { ok: true }
}

export async function requestPasswordReset(emailInput: string): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success) return { ok: false, error: 'That doesn’t look like an email address.' }

  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data) })
  // Identical response either way (CONTENT_SPEC.md §3) — confirming an account
  // exists here is an enumeration channel.
  if (user?.passwordHash) {
    const token = await issueToken('reset-password', parsed.data, RESET_TTL_MS)
    const link = `${siteUrl()}/reset/confirm?email=${encodeURIComponent(parsed.data)}&token=${token}`
    const { subject, text } = resetPasswordTemplate(link)
    await sendEmail({ to: parsed.data, subject, text }).catch((error) => {
      console.error('Failed to send reset email:', error)
    })
  }

  return { ok: true }
}

export async function resetPassword(
  emailInput: string,
  token: string,
  newPassword: string,
): Promise<AuthResult> {
  const parsedEmail = emailSchema.safeParse(emailInput)
  const parsedPassword = passwordSchema.safeParse(newPassword)
  if (!parsedEmail.success || !token) return { ok: false, error: 'That link is invalid.' }
  if (!parsedPassword.success) {
    return { ok: false, error: parsedPassword.error.issues[0]?.message ?? 'Check your password.' }
  }

  const valid = await consumeToken('reset-password', parsedEmail.data, token)
  if (!valid) return { ok: false, error: 'That link has expired. Request a new one.' }

  const user = await db.query.users.findFirst({ where: eq(users.email, parsedEmail.data) })
  if (!user) return { ok: false, error: 'That link is invalid.' }

  await db
    .update(users)
    .set({ passwordHash: await hash(parsedPassword.data, 12), updatedAt: new Date() })
    .where(eq(users.id, user.id))

  // A password reset is a credible signal the old password was compromised or
  // forgotten under uncertain circumstances — every existing session (and
  // whoever holds it) is logged out, not just the one making this request.
  await revokeAllSessions(user.id)

  return { ok: true }
}
