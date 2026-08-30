'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requireUserOrThrow } from '@/server/auth/guards'
import { track } from '@/server/analytics/track'
import {
  stepGoalsSchema,
  stepInterestsSchema,
  stepMentorProfileSchema,
  stepProfileSchema,
  stepRoleSchema,
  stepStageSchema,
} from './validation'

export type StepResult = { ok: true } | { ok: false; error: string }

/**
 * One function per step. Each writes immediately and independently — closing
 * the tab mid-flow loses at most the step in progress, never anything already
 * answered (spec §09). Every function starts with requireUserOrThrow():
 * these are called from a JSON API route (src/app/api/onboarding/step), not
 * rendered as a page, so an expired session must produce a 401 the client can
 * react to — not requireUserOrThrow()'s redirect(), which a fetch() call follows
 * silently and then fails to parse as JSON, turning a session expiry into a
 * generic "something went wrong" instead of a trip back to /login.
 */

export async function saveRoleStep(input: unknown): Promise<StepResult> {
  const user = await requireUserOrThrow()
  const parsed = stepRoleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Pick one.' }

  await db
    .update(users)
    .set({ platformRole: parsed.data.platformRole, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  return { ok: true }
}

export async function saveGoalsStep(input: unknown): Promise<StepResult> {
  const user = await requireUserOrThrow()
  const parsed = stepGoalsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Pick at least one.' }

  await db.update(users).set({ goals: parsed.data.goals, updatedAt: new Date() }).where(eq(users.id, user.id))
  return { ok: true }
}

export async function saveStageStep(input: unknown): Promise<StepResult> {
  const user = await requireUserOrThrow()
  const parsed = stepStageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Pick one.' }

  await db
    .update(users)
    .set({ journeyStage: parsed.data.journeyStage, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  return { ok: true }
}

export async function saveInterestsStep(input: unknown): Promise<StepResult> {
  const user = await requireUserOrThrow()
  const parsed = stepInterestsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Something went wrong.' }

  await db
    .update(users)
    .set({ interests: parsed.data.interests, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  return { ok: true }
}

export async function saveProfileStep(input: unknown): Promise<StepResult> {
  const user = await requireUserOrThrow()
  const parsed = stepProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your details.' }

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      school: parsed.data.school || null,
      graduationYear: parsed.data.graduationYear ?? null,
      linkedinUrl: parsed.data.linkedinUrl || null,
      bio: parsed.data.bio || null,
      skills: parsed.data.skills,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  return { ok: true }
}

/** The mentor-branch variant of step 5 (USER_JOURNEYS.md Journey 4). */
export async function saveMentorProfileStep(input: unknown): Promise<StepResult> {
  const user = await requireUserOrThrow()
  const parsed = stepMentorProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your details.' }

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      organization: parsed.data.organization || null,
      expertiseAreas: parsed.data.expertiseAreas,
      yearsOfExperience: parsed.data.yearsOfExperience ?? null,
      mentorAvailability: parsed.data.mentorAvailability,
      linkedinUrl: parsed.data.linkedinUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  return { ok: true }
}

/**
 * Marks onboarding complete. Distinct from "answered every step": a mentor's
 * flow has fewer steps than a student's, and this is the one signal every
 * flow converges on regardless of shape.
 */
export async function completeOnboarding(): Promise<StepResult> {
  const user = await requireUserOrThrow()
  await db
    .update(users)
    .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id))

  await track('onboarding_completed')

  return { ok: true }
}
