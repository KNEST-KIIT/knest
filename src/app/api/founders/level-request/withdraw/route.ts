import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { withdrawLevelRequest } from '@/server/founders/actions'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const requestId = typeof body?.requestId === 'string' ? body.requestId : null
  if (!requestId) return NextResponse.json({ error: 'Missing request.' }, { status: 400 })

  try {
    const result = await withdrawLevelRequest(requestId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
