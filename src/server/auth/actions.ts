import 'server-only'

import { compare, hash } from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { accounts, sessions, users } from '@/db/schema'
import { accountExistsTemplate, resetPasswordTemplate, setupPasswordTemplate, verifyEmailTemplate } from '@/server/email/templates'
import { sendEmail } from '@/server/email/send'
import { consumeToken, issueToken } from './tokens'
import { DUMMY_HASH } from './dummy-hash'
import { createDatabaseSession, destroyDatabaseSession } from './session'
import { credentialsSchema, emailSchema, passwordSchema, signupSchema } from './validation'
import { track } from '@/server/analytics/track'
import { siteUrl } from '@/lib/site-url'
import { safeNext } from '@/lib/safe-next'

export type AuthResult = { ok: true } | { ok: false; error: string; serverError?: boolean }

export class ActivationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActivationError'
  }
}

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000
const RESET_TTL_MS = 60 * 60 * 1000


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

  if (!user.emailVerified) {
    return { ok: false, error: 'Verify your email before signing in.' }
  }

  await createDatabaseSession(user.id)
  return { ok: true }
}

/**
 * Signup answers the same way whether or not the address already has an
 * account (KN-22b), so it cannot be used to find out who is registered.
 *
 * - A new address gets an unverified account and a verification link.
 * - An address that exists gets an "you already have an account" message at
 *   that mailbox, and nothing about the request changes.
 *
 * Neither path issues a session: a session for the new case and none for the
 * existing case would itself reveal which one happened. The person signs in by
 * opening the link in their mailbox (confirmEmailVerification issues the
 * session), so they still arrive in onboarding without a separate login step.
 * The password is hashed before the lookup so the response time is the same
 * on both paths.
 */
export async function signUpWithPassword(input: unknown): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your details.' }
  }
  const next = safeNext((input as { next?: unknown } | null)?.next as string | undefined)

  const passwordHash = parsed.data.password ? await hash(parsed.data.password, 12) : null
  const [created] = await db
    .insert(users)
    .values({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      platformRole: 'student',
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email })

  if (!created) {
    const { subject, text } = accountExistsTemplate(`${siteUrl()}/login`, `${siteUrl()}/reset`)
    await sendEmail({ to: parsed.data.email, subject, text }).catch((error) => {
      console.error('Failed to send account-exists email:', error)
    })
    return { ok: true }
  }

  await track('signup', undefined, { userId: created.id })
  await sendVerificationEmail(created.email, next).catch((error) => {
    // The account exists; a mail-send failure must not fail the request. The
    // person can ask for the link again from /verify.
    console.error('Failed to send verification email:', error)
  })

  return { ok: true }
}

export async function logout(): Promise<void> {
  await destroyDatabaseSession()
}

export async function sendVerificationEmail(emailInput: string, next?: string | null): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success) return { ok: false, error: 'That doesn’t look like an email address.' }

  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data) })
  // Same response whether or not the account exists — this endpoint is
  // reachable while signed out (a "resend" link on /verify), so it must not
  // become a way to check which emails have accounts.
  if (!user || user.emailVerified) return { ok: true }

  const token = await issueToken('verify-email', parsed.data, VERIFY_TTL_MS)
  const returnTo = safeNext(next)
  const nextParam = returnTo ? `&next=${encodeURIComponent(returnTo)}` : ''
  const link = `${siteUrl()}/verify/confirm?email=${encodeURIComponent(parsed.data)}&token=${token}${nextParam}`
  const { subject, text } = verifyEmailTemplate(link)
  await sendEmail({ to: parsed.data, subject, text })

  return { ok: true }
}

export async function confirmEmailVerification(
  emailInput: string,
  token: string,
  newPassword?: string,
): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success || !token) return { ok: false, error: 'That link is invalid.' }

  // 1. If newPassword is provided, validate and hash it upfront
  let newPasswordHash: string | null = null
  if (newPassword !== undefined && newPassword !== '') {
    const parsedPw = passwordSchema.safeParse(newPassword)
    if (!parsedPw.success) {
      return { ok: false, error: parsedPw.error.issues[0]?.message ?? 'Choose a password of at least 12 characters to activate your account.' }
    }
    newPasswordHash = await hash(parsedPw.data, 12)
  }

  // 2. Perform verification inside a transaction with row locking
  // If anything is invalid (e.g. missing password on unverified account), throwing rolls back the transaction
  // so the single-use token is NEVER consumed.
  try {
    const result = await db.transaction(async (tx) => {
      // Lock user row with FOR UPDATE to prevent race conditions
      const [user] = await tx
        .select({
          id: users.id,
          isActive: users.isActive,
          emailVerified: users.emailVerified,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.email, parsed.data))
        .for('update')

      if (!user || !user.isActive) {
        throw new ActivationError('That link has expired. Request a new one.')
      }

      // Check for linked OAuth accounts (e.g. Google) inside transaction
      const [linkedAccount] = await tx
        .select({ provider: accounts.provider })
        .from(accounts)
        .where(eq(accounts.userId, user.id))
        .limit(1)

      const isAlreadyVerified = user.emailVerified !== null || Boolean(linkedAccount)

      // QA-004 protection: For unverified accounts, a freshly supplied owner password is MANDATORY.
      // Never fall back to an unverified stored hash from signup.
      // Throwing before consumeToken ensures the single-use token is NOT consumed on missing password.
      if (!isAlreadyVerified && !newPasswordHash) {
        throw new ActivationError('Choose a password of at least 12 characters to activate your account.')
      }

      // Consume token inside transaction after all prerequisite checks pass
      const consumed = await consumeToken('verify-email', parsed.data, token, tx)
      if (!consumed) {
        throw new ActivationError('That link has expired. Request a new one.')
      }

      if (isAlreadyVerified) {
        // Account is already established: preserve credentials, do not overwrite password, do not revoke existing sessions
        return { userId: user.id }
      }

      // Unverified account being activated: set freshly supplied owner password
      const [updated] = await tx
        .update(users)
        .set({
          emailVerified: new Date(),
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, user.id), isNull(users.emailVerified)))
        .returning({ id: users.id })

      if (!updated) {
        // If another concurrent transaction just verified the account, preserve it
        return { userId: user.id }
      }

      // Revoke all pre-verification sessions
      await tx.delete(sessions).where(eq(sessions.userId, user.id))
      return { userId: user.id }
    })

    // Proving mailbox ownership creates a session for the owner
    if (result.userId) {
      await createDatabaseSession(result.userId)
    }
    return { ok: true }
  } catch (err: unknown) {
    if (err instanceof ActivationError) {
      return { ok: false, error: err.message }
    }
    const errCategory = err && typeof err === 'object' && 'name' in err && typeof err.name === 'string'
      ? `${err.name}${'code' in err && typeof err.code === 'string' ? ` [${err.code}]` : ''}`
      : 'UnknownError'
    console.error(`Unexpected error during email verification confirmation: category=${errCategory}`)
    return {
      ok: false,
      error: 'We could not complete your account activation. Please try again.',
      serverError: true,
    }
  }
}

export async function requestPasswordReset(emailInput: string, next?: string | null): Promise<AuthResult> {
  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success) return { ok: false, error: 'That doesn’t look like an email address.' }

  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data) })
  // Identical response either way (CONTENT_SPEC.md §3) — confirming an account
  // exists here is an enumeration channel.
  if (user?.isActive && (user.passwordHash || user.emailVerified)) {
    const token = await issueToken('reset-password', parsed.data, RESET_TTL_MS)
    const returnTo = safeNext(next)
    const link = `${siteUrl()}/reset/confirm?email=${encodeURIComponent(parsed.data)}&token=${token}${returnTo ? `&next=${encodeURIComponent(returnTo)}` : ''}`
    const { subject, text } = user.passwordHash ? resetPasswordTemplate(link) : setupPasswordTemplate(link)
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

  // Token consumption, password replacement and revocation either all commit
  // or all roll back. A failed write must not burn the only recovery link.
  const passwordHash = await hash(parsedPassword.data, 12)
  const valid = await db.transaction(async (tx) => {
    if (!(await consumeToken('reset-password', parsedEmail.data, token, tx))) return false
    const [user] = await tx.update(users)
      .set({ passwordHash, emailVerified: new Date(), updatedAt: new Date() })
      .where(eq(users.email, parsedEmail.data))
      .returning({ id: users.id })
    if (user) await tx.delete(sessions).where(eq(sessions.userId, user.id))
    return Boolean(user)
  })
  if (!valid) return { ok: false, error: 'That link has expired. Request a new one.' }

  return { ok: true }
}
