import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { changeApplicationStatus } from '@/server/applications/review'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const status = body?.status as
    | 'under_review'
    | 'shortlisted'
    | 'interview'
    | 'accepted'
    | 'rejected'
    | 'waitlisted'
    | undefined

  if (!status) return NextResponse.json({ error: 'Missing status.' }, { status: 400 })

  try {
    const result = await changeApplicationStatus(id, status, body?.note)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}
