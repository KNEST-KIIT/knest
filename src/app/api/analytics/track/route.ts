import { NextResponse } from 'next/server'
import { isClientEvent, sanitiseProps } from '@/server/analytics/events'
import { track } from '@/server/analytics/track'
import { checkRateLimit, clientIp, RATE_LIMITS } from '@/server/security/rate-limit'

/**
 * The one client-triggered tracking call site — for an event that happens
 * entirely client-side with no other server round-trip to piggyback on
 * (the journey selector's selection, before any navigation). Every other
 * funnel event fires from inside an existing server action, route handler
 * or page render instead of adding a second network call for it.
 *
 * Deliberately open to signed-out visitors, because the journey selector is
 * on the homepage and the choice a visitor makes before signing up is the most
 * useful thing in the funnel. What it is not open to is arbitrary writes: the
 * event name has to be on `CLIENT_EVENTS`, the props are narrowed to flat
 * scalars, and the whole thing is rate limited by IP. Before this any caller
 * could write any string into `app.analytics_events` without limit, and the
 * staff analytics page has no way to tell an invented row from a real one.
 */
export async function POST(request: Request) {
  const allowed = await checkRateLimit(`analytics:${clientIp(request)}`, RATE_LIMITS.analyticsTrack)
  if (!allowed) {
    // 204 rather than 429: this is fire-and-forget from the client, which does
    // not read the response, and a visitor clicking through the selector a few
    // times is not doing anything wrong. Dropping the write silently is the
    // honest outcome.
    return new NextResponse(null, { status: 204 })
  }

  const body = await request.json().catch(() => null)
  if (!isClientEvent(body?.event)) {
    return NextResponse.json({ error: 'Unknown event.' }, { status: 400 })
  }

  await track(body.event, sanitiseProps(body?.props))
  return NextResponse.json({ ok: true })
}
