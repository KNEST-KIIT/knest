/**
 * Where the client's address comes from decides whether per-IP limits mean
 * anything. A client-supplied X-Forwarded-For can be anything, so a limiter keyed
 * on it is bypassed by changing the header (KN-22c).
 *
 *  - `cloudfront` (the production default): the address comes only from
 *    CloudFront-Viewer-Address, a header CloudFront sets itself. It is trustworthy
 *    because the origin accepts traffic only from our distribution (origin
 *    verification, src/server/security/edge-guard.ts).
 *  - `x-forwarded-for`: the first hop of the header. For local development and
 *    the test suite, never behind the public internet.
 */
export type ClientIpSource = 'cloudfront' | 'x-forwarded-for'

export type ClientIpEnv = { [name: string]: string | undefined; CLIENT_IP_SOURCE?: string; NODE_ENV?: string }

export function clientIpSource(env: ClientIpEnv): ClientIpSource {
  if (env.CLIENT_IP_SOURCE === 'cloudfront' || env.CLIENT_IP_SOURCE === 'x-forwarded-for') return env.CLIENT_IP_SOURCE
  return env.NODE_ENV === 'production' ? 'cloudfront' : 'x-forwarded-for'
}

/** "203.0.113.7:51234" or "2001:db8::1:51234" (the port follows the last colon); brackets tolerated. */
function addressOnly(viewer: string): string {
  const value = viewer.trim()
  const bracket = /^\[(.+)\]:(\d+)$/.exec(value)
  if (bracket) return bracket[1]!
  const lastColon = value.lastIndexOf(':')
  if (lastColon === -1) return value
  const port = value.slice(lastColon + 1)
  return /^\d+$/.test(port) ? value.slice(0, lastColon) : value
}

export function clientIpFromHeaders(get: (name: string) => string | null, env: ClientIpEnv): string {
  if (clientIpSource(env) === 'cloudfront') {
    const viewer = get('cloudfront-viewer-address')
    return viewer ? addressOnly(viewer) || 'unknown' : 'unknown'
  }
  return get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
