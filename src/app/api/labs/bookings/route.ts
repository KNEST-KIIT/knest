import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { CapabilityError, capabilityDeniedMessage } from '@/server/founders/levels'
import { requestLabBooking } from '@/server/labs/actions'
import { RateLimitError } from '@/server/security/rate-limit'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  try {
    const result = await requestLabBooking({
      labId: Number(body?.labId),
      startsAt: typeof body?.startsAt === 'string' ? body.startsAt : '',
      slots: body?.slots === undefined ? undefined : Number(body.slots),
      purpose: typeof body?.purpose === 'string' ? body.purpose : '',
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, bookingId: result.bookingId })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'You’ve booked a lot today. Try again tomorrow.' },
        { status: 429 },
      )
    }
    // Before the plain UnauthorizedError branch: CapabilityError subclasses it,
    // so a subclass matches both and the more specific message would be lost.
    if (error instanceof CapabilityError) {
      return NextResponse.json({ error: capabilityDeniedMessage(error) }, { status: error.status })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
