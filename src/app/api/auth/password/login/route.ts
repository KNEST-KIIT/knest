import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { loginWithPassword } from '@/server/auth/actions'
import { checkRateLimit, clientIp, hasRateLimitCapacity, RATE_LIMITS } from '@/server/security/rate-limit'
import { captchaFailure } from '@/server/security/captcha'

export async function POST(request: Request) {
  const allowed = await checkRateLimit(`login:${clientIp(request)}`, RATE_LIMITS.login)
  if (!allowed) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const captcha = await captchaFailure(request, body, 'login')
  if (captcha) return captcha

  // Per-account throttle on FAILED attempts only, keyed on a hash of the e-mail whether or not the
  // account exists, so it cannot reveal which addresses are registered and a successful sign-in
  // never counts against the account.
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const accountKey = email ? `loginAccount:${createHash('sha256').update(email).digest('hex')}` : null
  if (accountKey && !(await hasRateLimitCapacity(accountKey, RATE_LIMITS.loginAccount))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const result = await loginWithPassword(body)

  if (!result.ok) {
    if (accountKey) await checkRateLimit(accountKey, RATE_LIMITS.loginAccount)
    return NextResponse.json({ error: result.error }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
