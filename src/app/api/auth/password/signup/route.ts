import { NextResponse } from 'next/server'
import { signUpWithPassword } from '@/server/auth/actions'
import { checkRateLimit, clientIp, RATE_LIMITS } from '@/server/security/rate-limit'

export async function POST(request: Request) {
  const allowed = await checkRateLimit(`signup:${clientIp(request)}`, RATE_LIMITS.signup)
  if (!allowed) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const result = await signUpWithPassword(body)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
