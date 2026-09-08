import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { requestLevelUp } from '@/server/founders/actions'
import { RateLimitError } from '@/server/security/rate-limit'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const requestedLevel = Number(body?.requestedLevel)
  const evidence = typeof body?.evidence === 'string' ? body.evidence : ''

  try {
    const result = await requestLevelUp({ requestedLevel, evidence })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, requestId: result.requestId })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'You’ve sent a few of these recently. Try again tomorrow.' },
        { status: 429 },
      )
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
