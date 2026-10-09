import { NextResponse } from 'next/server'
import { clientIp } from './rate-limit'
import { verifyTurnstile } from './turnstile'

/**
 * For route handlers: returns a ready response when the request's Turnstile token is
 * missing or rejected, or null when the handler may go on. Reads `turnstileToken` from
 * the already-parsed JSON body.
 */
export async function captchaFailure(request: Request, body: unknown): Promise<NextResponse | null> {
  const token = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).turnstileToken : undefined
  const result = await verifyTurnstile(token, clientIp(request))
  if (result.ok) return null

  if (result.reason === 'unavailable' || result.reason === 'not-configured') {
    return NextResponse.json(
      { error: 'We couldn’t run the human check right now. Try again in a minute.', code: 'captcha-unavailable' },
      { status: 503 },
    )
  }
  return NextResponse.json(
    { error: 'We couldn’t confirm you are human. Wait for the check to finish, or reload the page, and try again.', code: 'captcha' },
    { status: 400 },
  )
}
