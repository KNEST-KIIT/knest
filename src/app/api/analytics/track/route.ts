import { NextResponse } from 'next/server'
import { MAX_BODY_BYTES, parseClientEvent } from '@/server/analytics/client-events'
import { track } from '@/server/analytics/track'
import { checkRateLimit, clientIp, RATE_LIMITS } from '@/server/security/rate-limit'

/**
 * The one client-triggered tracking call site: for an event that happens
 * entirely client-side with no other server round-trip to piggyback on (the
 * journey selector's selection, before any navigation). Every other funnel
 * event fires from inside an existing server action, route handler or page
 * render.
 *
 * Open to signed-out visitors, because the choice a visitor makes before
 * signing up is the most useful thing in the funnel. It is not open to
 * arbitrary writes (KN-11): the event name must be on CLIENT_EVENTS, props are
 * narrowed to flat bounded scalars, the body is size-capped, and the route is
 * rate limited by IP.
 *
 * Over the limit it answers 204 rather than 429: the client is fire-and-forget
 * and never reads the response, and dropping the write is the honest outcome.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'Too large.' }, { status: 413 })

  try {
    const allowed = await checkRateLimit(`analytics:${clientIp(request)}`, RATE_LIMITS.analyticsTrack)
    if (!allowed) return new NextResponse(null, { status: 204 })
  } catch (error) {
    // Rate-limit storage unavailable: analytics must never break a page, and an
    // unlimited write path must not open either, so drop the event.
    console.error('[analytics] rate limit check failed; event dropped', error)
    return new NextResponse(null, { status: 204 })
  }

  const text = await request.text().catch(() => '')
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Too large.' }, { status: 413 })

  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    // falls through to the validation failure below
  }
  const parsed = parseClientEvent(body)
  if (!parsed) return NextResponse.json({ error: 'Unknown event.' }, { status: 400 })

  await track(parsed.event, parsed.props)
  return NextResponse.json({ ok: true })
}
