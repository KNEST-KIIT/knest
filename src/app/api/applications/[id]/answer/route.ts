import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { saveAnswer } from '@/server/applications/actions'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const questionId = body?.questionId as string | undefined
  if (!questionId) return NextResponse.json({ error: 'Missing question.' }, { status: 400 })

  try {
    const result = await saveAnswer(id, questionId, body?.value)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
