'use server'

import { compare, hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { createDatabaseSession, destroyDatabaseSession } from './session'
import { credentialsSchema, signupSchema } from './validation'

export type AuthResult = { ok: true } | { ok: false; error: string }

/** Timing-equalising comparison target for accounts that do not exist. */
const DUMMY_HASH = '$2b$12$0000000000000000000000000000000000000000000000000000'

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
    return { ok: false, error: 'That email and password do not match.' }
  }

  await createDatabaseSession(user.id)
  return { ok: true }
}

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
    return { ok: false, error: 'That email cannot be used to sign up.' }
  }

  const [created] = await db
    .insert(users)
    .values({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await hash(parsed.data.password, 12),
      platformRole: 'student',
    })
    .returning({ id: users.id })

  if (!created) return { ok: false, error: 'We could not create that account.' }

  await createDatabaseSession(created.id)
  return { ok: true }
}

export async function logout(): Promise<void> {
  await destroyDatabaseSession()
}
