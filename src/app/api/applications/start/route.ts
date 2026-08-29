import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { startApplication } from '@/server/applications/actions'

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
    throw error
  }
}
