import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { startApplication } from '@/server/applications/actions'
import { RateLimitError } from '@/server/security/rate-limit'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const programSlug = body?.programSlug as string | undefined
  if (!programSlug) return NextResponse.json({ error: 'Missing program.' }, { status: 400 })

  try {
    const result = await startApplication(programSlug)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, applicationId: result.applicationId })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }
    throw error
  }
}
