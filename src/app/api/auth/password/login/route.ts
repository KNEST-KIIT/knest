import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { loginWithPassword } from '@/server/auth/actions'
import { checkRateLimit, clientIp, hasRateLimitCapacity, RATE_LIMITS } from '@/server/security/rate-limit'
import { captchaFailure } from '@/server/security/captcha'
import { passwordGateFull } from '@/server/auth/password-work'

export async function POST(request: Request) {
  // Only failed attempts spend the address budget: a lecture hall of students on one campus address
  // signing in successfully must not lock itself out. A guess still costs a token each time.
  const ipKey = `login:${clientIp(request)}`
  if (!(await hasRateLimitCapacity(ipKey, RATE_LIMITS.login))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  // Busy is answered before the human check runs: a Turnstile token can be used once, and a person told to
  // retry must be able to retry with the same one.
  if (passwordGateFull()) {
    return NextResponse.json({ error: 'Sign-in is busy right now. Try again in a moment.' }, { status: 503, headers: { 'retry-after': '5' } })
  }

  const body = await request.json().catch(() => null)
  const captcha = await captchaFailure(request, body, 'login')
  if (captcha) {
    await checkRateLimit(ipKey, RATE_LIMITS.login)
    return captcha
  }

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
    // "Busy" is the server's problem, not a wrong password: tell the browser to retry and charge nobody.
    if (result.serverError) return NextResponse.json({ error: result.error }, { status: 503, headers: { 'retry-after': '5' } })
    if (accountKey) await checkRateLimit(accountKey, RATE_LIMITS.loginAccount)
    await checkRateLimit(ipKey, RATE_LIMITS.login)
    return NextResponse.json({ error: result.error }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
