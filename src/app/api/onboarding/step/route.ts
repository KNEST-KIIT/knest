import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import {
  completeOnboarding,
  saveGoalsStep,
  saveInterestsStep,
  saveMentorProfileStep,
  saveProfileStep,
  saveRoleStep,
  saveStageStep,
} from '@/server/onboarding/actions'

const HANDLERS = {
  role: saveRoleStep,
  goals: saveGoalsStep,
  stage: saveStageStep,
  interests: saveInterestsStep,
  profile: saveProfileStep,
  'mentor-profile': saveMentorProfileStep,
  complete: () => completeOnboarding(),
} as const

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const step = body?.step as keyof typeof HANDLERS | undefined
  const handler = step ? HANDLERS[step] : undefined

  if (!handler) return NextResponse.json({ error: 'Unknown step.' }, { status: 400 })

  try {
    const result = await (step === 'complete' ? handler(undefined) : handler(body?.data))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
