import { NextResponse } from 'next/server'
import { getSessionUser } from '@/server/auth/guards'
import { requestPasswordReset } from '@/server/auth/actions'
import { checkRateLimit, RATE_LIMITS } from '@/server/security/rate-limit'

/** Always address the signed-in member's mailbox, never a caller-supplied email. */
export async function POST() {
  const user = await getSessionUser()
  if (!user?.email) return NextResponse.json({ error: 'Sign in to add a password.' }, { status: 401 })
  if (!(await checkRateLimit(`password-setup:${user.id}`, RATE_LIMITS.passwordResetRequest))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }
  const result = await requestPasswordReset(user.email, '/dashboard/account')
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 })
}
