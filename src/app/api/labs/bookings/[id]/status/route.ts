import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { decideLabBooking } from '@/server/labs/review'

const DECISIONS: readonly string[] = ['approved', 'rejected']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const status = body?.status
  const note = typeof body?.note === 'string' ? body.note : undefined

  if (!DECISIONS.includes(status)) {
    return NextResponse.json({ error: 'That isn’t a decision.' }, { status: 400 })
  }

  try {
    const result = await decideLabBooking(id, status as 'approved', note)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}
