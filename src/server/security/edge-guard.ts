import { timingSafeEqual } from 'node:crypto'

/**
 * Two checks that run before any route code, from src/proxy.ts. Kept free of
 * Next.js types so they can be unit-tested directly.
 *
 * 1. Origin verification. In production the app sits behind CloudFront, and its
 *    security group admits CloudFront's address range, which is shared by every
 *    CloudFront customer. A secret header that only our distribution adds closes
 *    that gap: a request that reaches the origin without it is refused.
 * 2. Same-origin writes. A state-changing request that carries an Origin header
 *    from somewhere else is refused. SameSite=Lax cookies already stop browsers
 *    attaching the session to such a request; this is the second line.
 */

export type GuardEnv = {
  // process.env is an open record; the named keys below are the ones read here.
  [name: string]: string | undefined
  ORIGIN_VERIFY_SECRET?: string
  SITE_URL?: string
  NEXT_PUBLIC_SITE_URL?: string
  ALLOWED_ORIGINS?: string
}

export type GuardDecision = { allow: true } | { allow: false; status: 403; reason: 'origin-verify' | 'origin-mismatch' }

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Local container health checks do not pass through CloudFront. The endpoint reveals only ok/unavailable. */
const HEALTH_PATH = '/api/health'

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function toOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function allowedOrigins(env: GuardEnv): Set<string> {
  const origins = new Set<string>()
  const site = env.SITE_URL || env.NEXT_PUBLIC_SITE_URL
  const own = site ? toOrigin(site) : null
  if (own) origins.add(own)
  for (const extra of (env.ALLOWED_ORIGINS ?? '').split(',')) {
    const origin = extra.trim() ? toOrigin(extra.trim()) : null
    if (origin) origins.add(origin)
  }
  return origins
}

export function guardRequest(
  input: { method: string; pathname: string; header: (name: string) => string | null },
  env: GuardEnv,
): GuardDecision {
  const secret = env.ORIGIN_VERIFY_SECRET
  if (secret && input.pathname !== HEALTH_PATH) {
    const presented = input.header('x-origin-verify')
    if (!presented || !safeEqual(presented, secret)) return { allow: false, status: 403, reason: 'origin-verify' }
  }

  if (UNSAFE_METHODS.has(input.method.toUpperCase())) {
    const origin = input.header('origin')
    const allowed = allowedOrigins(env)
    // Only enforced when the site's own address is configured; a missing Origin
    // (non-browser clients) is allowed because the cookie rules cover browsers.
    if (origin !== null && allowed.size > 0 && !allowed.has(origin)) {
      return { allow: false, status: 403, reason: 'origin-mismatch' }
    }
  }

  return { allow: true }
}
