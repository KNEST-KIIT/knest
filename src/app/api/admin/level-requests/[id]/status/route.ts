import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { decideLevelRequest } from '@/server/founders/review'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const status = body?.status
  const note = typeof body?.note === 'string' ? body.note : undefined

  if (status !== 'approved' && status !== 'rejected') {
    return NextResponse.json({ error: 'That isn’t a decision.' }, { status: 400 })
  }

  try {
    const result = await decideLevelRequest(id, status, note)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}
