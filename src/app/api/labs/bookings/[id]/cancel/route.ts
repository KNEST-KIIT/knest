import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { cancelLabBooking } from '@/server/labs/actions'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const reason = typeof body?.reason === 'string' ? body.reason : undefined

  try {
    const result = await cancelLabBooking(id, reason)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
