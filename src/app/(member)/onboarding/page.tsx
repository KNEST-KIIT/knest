import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requireUser } from '@/server/auth/guards'
import type { JourneyStage } from '@/server/auth/roles'
import { JOURNEY_STAGES } from '@/server/onboarding/validation'
import { OnboardingFlow } from './onboarding-flow'

export const metadata: Metadata = { title: 'Your KNEST path' }

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const sessionUser = await requireUser('/onboarding')
  const { stage } = await searchParams

  // Onboarding is re-openable to change answers even after completion — the
  // "Not quite right? Change your answers." link relies on that — so this
  // does not redirect an already-onboarded user away.
  const user = await db.query.users.findFirst({ where: eq(users.id, sessionUser.id) })
  if (!user) redirect('/login')

  const stagePrefill = JOURNEY_STAGES.includes(stage as JourneyStage) ? (stage as JourneyStage) : null

  return (
    <OnboardingFlow
      stagePrefill={stagePrefill}
      initial={{
        platformRole: user.platformRole,
        goals: user.goals,
        journeyStage: user.journeyStage ?? stagePrefill,
        interests: user.interests,
        name: user.name ?? '',
        school: user.school ?? '',
        linkedinUrl: user.linkedinUrl ?? '',
        bio: user.bio ?? '',
        organization: user.organization ?? '',
        expertiseAreas: user.expertiseAreas,
        mentorAvailability: user.mentorAvailability,
      }}
    />
  )
}
