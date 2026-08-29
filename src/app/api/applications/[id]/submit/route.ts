import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { submitApplication } from '@/server/applications/actions'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const result = await submitApplication(id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
