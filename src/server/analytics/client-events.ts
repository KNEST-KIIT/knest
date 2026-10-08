/**
 * What a browser is allowed to write to app.analytics_events (KN-11).
 *
 * Every other funnel event is recorded server-side from inside an action, so
 * the only event a browser has any business sending is one that happens
 * entirely client-side before any server round-trip. Anything not listed here
 * is rejected: the staff analytics page cannot tell an invented row from a real
 * one, so the door has to be an allow-list rather than a filter.
 */
export const CLIENT_EVENTS = ['journey_selector_choice'] as const
export type ClientEvent = (typeof CLIENT_EVENTS)[number]

const MAX_PROP_KEYS = 5
const MAX_KEY_LENGTH = 32
const MAX_STRING_LENGTH = 64
export const MAX_BODY_BYTES = 2048

export type ClientEventPayload = { event: ClientEvent; props: Record<string, string | number | boolean> }

function isClientEvent(value: unknown): value is ClientEvent {
  return typeof value === 'string' && (CLIENT_EVENTS as readonly string[]).includes(value)
}

/** Flat scalars only, bounded in count and length; anything else is dropped. */
export function sanitiseProps(input: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return out
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_PROP_KEYS) break
    if (key.length === 0 || key.length > MAX_KEY_LENGTH) continue
    if (typeof value === 'string') out[key] = value.slice(0, MAX_STRING_LENGTH)
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    else if (typeof value === 'boolean') out[key] = value
  }
  return out
}

/** Returns a safe payload, or null if the body is not an allowed client event. */
export function parseClientEvent(body: unknown): ClientEventPayload | null {
  if (typeof body !== 'object' || body === null) return null
  const { event, props } = body as { event?: unknown; props?: unknown }
  if (!isClientEvent(event)) return null
  return { event, props: sanitiseProps(props) }
}
