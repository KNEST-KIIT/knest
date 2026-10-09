import { NextResponse } from 'next/server'
import { getSessionUser } from '@/server/auth/guards'
import { checkRateLimit, clientIp, RATE_LIMITS } from './rate-limit'

type LimitName = keyof typeof RATE_LIMITS

const TOO_MANY = { error: 'Too many requests. Wait a moment and try again.' }

/** Limits by connection address. Returns a 429 response to send, or null to carry on. */
export async function limitByIp(request: Request, name: LimitName, extraKey = ''): Promise<NextResponse | null> {
  const allowed = await checkRateLimit(`${name}:${clientIp(request)}${extraKey ? ':' + extraKey : ''}`, RATE_LIMITS[name])
  return allowed ? null : NextResponse.json(TOO_MANY, { status: 429 })
}

/**
 * Limits by signed-in user. With no session it lets the request through: the route's own sign-in
 * check answers 401, and an anonymous caller must not be able to drain someone else's bucket.
 */
export async function limitByUser(name: LimitName): Promise<NextResponse | null> {
  const user = await getSessionUser()
  if (!user) return null
  const allowed = await checkRateLimit(`${name}:${user.id}`, RATE_LIMITS[name])
  return allowed ? null : NextResponse.json(TOO_MANY, { status: 429 })
}
