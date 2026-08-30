import { NextResponse } from 'next/server'
import { loginWithPassword } from '@/server/auth/actions'
import { checkRateLimit, clientIp, RATE_LIMITS } from '@/server/security/rate-limit'

export async function POST(request: Request) {
  const allowed = await checkRateLimit(`login:${clientIp(request)}`, RATE_LIMITS.login)
  if (!allowed) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const result = await loginWithPassword(body)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
