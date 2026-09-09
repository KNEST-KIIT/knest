/**
 * The events a browser is allowed to report.
 *
 * `POST /api/analytics/track` was open: no session, no rate limit, no
 * allow-list. Any caller could write any `event` string into
 * `app.analytics_events` as many times as they liked, which is enough to bury
 * the funnel the staff analytics page reads in whatever someone felt like
 * typing — and the page has no way to tell a real row from an invented one.
 *
 * Requiring a session is not the fix. The one legitimate caller is the journey
 * selector on the homepage, which fires for signed-out visitors and is the
 * single most useful thing in the funnel precisely because it happens before
 * anyone signs up. So the gate is an allow-list of the events a browser has
 * any business sending, plus a rate limit, and everything else stays where it
 * already is: fired server-side from inside an action that has already
 * happened.
 *
 * Adding an event here is a deliberate act. If a new client-side event needs
 * reporting, it goes in this list and nowhere else.
 */
export const CLIENT_EVENTS = ['journey_selector_choice'] as const

export type ClientEvent = (typeof CLIENT_EVENTS)[number]

export function isClientEvent(value: unknown): value is ClientEvent {
  return typeof value === 'string' && (CLIENT_EVENTS as readonly string[]).includes(value)
}

/** Keeps a hostile caller from writing a megabyte of JSON per request. */
const MAX_PROPS_KEYS = 10
const MAX_VALUE_LENGTH = 200

/**
 * Narrows arbitrary JSON to something safe to store.
 *
 * Only flat scalars survive: nested objects and arrays are dropped rather than
 * truncated, because a props blob is meant to be a handful of labels and
 * anything shaped like a payload is not one.
 */
export function sanitiseProps(input: unknown): Record<string, string | number | boolean> | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined

  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_PROPS_KEYS) break
    if (key.length > 64) continue
    if (typeof value === 'string') out[key] = value.slice(0, MAX_VALUE_LENGTH)
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    else if (typeof value === 'boolean') out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}
