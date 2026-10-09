import { NextResponse } from 'next/server'
import { getSessionUser } from '@/server/auth/guards'
import { submitEnquiry } from '@/server/enquiries/actions'
import { captchaFailure } from '@/server/security/captcha'
import { checkRateLimit, clientIp, RATE_LIMITS } from '@/server/security/rate-limit'

export async function POST(request: Request) {
  const allowed = await checkRateLimit(`enquiry:${clientIp(request)}`, RATE_LIMITS.enquirySubmit)
  if (!allowed) return NextResponse.json({ error: 'Too many messages from this connection. Try again later.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const captcha = await captchaFailure(request, body)
  if (captcha) return captcha

  const user = await getSessionUser()
  const result = await submitEnquiry(body, { userId: user?.id ?? null })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
