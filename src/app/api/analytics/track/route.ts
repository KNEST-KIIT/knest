import { NextResponse } from 'next/server'
import { track } from '@/server/analytics/track'

/**
 * The one client-triggered tracking call site — for an event that happens
 * entirely client-side with no other server round-trip to piggyback on
 * (the journey selector's selection, before any navigation). Every other
 * funnel event fires from inside an existing server action, route handler
 * or page render instead of adding a second network call for it.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const event = typeof body?.event === 'string' ? body.event : null
  if (!event) return NextResponse.json({ error: 'Missing event.' }, { status: 400 })

  await track(event, typeof body?.props === 'object' ? body.props : undefined)
  return NextResponse.json({ ok: true })
}
