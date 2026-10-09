import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { markNotificationRead } from '@/server/notifications/actions'
import { limitByUser } from '@/server/security/route-limits'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await limitByUser('notificationRead')
  if (limited) return limited

  try {
    const result = await markNotificationRead(id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
