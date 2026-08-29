import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { unregisterFromEvent } from '@/server/events/actions'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const eventId = Number(id)
  if (!Number.isInteger(eventId)) return NextResponse.json({ error: 'Invalid event.' }, { status: 400 })

  try {
    const result = await unregisterFromEvent(eventId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
