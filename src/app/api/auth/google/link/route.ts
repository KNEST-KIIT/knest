import { compare } from 'bcryptjs'
import { NextResponse } from 'next/server'
import { signIn } from '@/server/auth'
import { currentLinkSession, issueGoogleLinkGrant } from '@/server/auth/google-link'
import { googleConfigured } from '@/server/auth/providers'
import { checkRateLimit, clientIp, RATE_LIMITS } from '@/server/security/rate-limit'

export async function POST(request: Request) {
  const current = await currentLinkSession()
  if (!current) return NextResponse.json({ error: 'Sign in to connect Google.' }, { status: 401 })
  if (!googleConfigured()) return NextResponse.json({ error: 'Google sign-in is unavailable.' }, { status: 503 })
  if (!(await checkRateLimit(`google-link:${current.id}:${clientIp(request)}`, RATE_LIMITS.login)) ||
      !(await checkRateLimit(`google-link-account:${current.id}`, RATE_LIMITS.loginAccount))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }
  const body = await request.json().catch(() => null)
  if (!current.passwordHash || typeof body?.password !== 'string' || body.password.length > 200 ||
      !(await compare(body.password, current.passwordHash))) {
    return NextResponse.json({ error: 'Enter your current KNEST password to connect Google.' }, { status: 400 })
  }
  try {
    await issueGoogleLinkGrant(current.token)
    const url = await signIn('google', { redirectTo: '/dashboard/account?google=connected', redirect: false })
    if (typeof url !== 'string') throw new Error('Missing provider redirect')
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'Google sign-in could not start. Try again.' }, { status: 503 })
  }
}
