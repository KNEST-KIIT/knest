import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { limitByUser } from '@/server/security/route-limits'
import { resendOutboxMessage } from '@/server/email/admin'

/** An operator resends one message that did not go out. Super admin only. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await limitByUser('staffAction')
  if (limited) return limited
  const { id } = await params
  try {
    const result = await resendOutboxMessage(id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}
