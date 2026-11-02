import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Event } from '@/payload/payload-types'
import { cachedRead, cachedReadOr } from './cache'

export type EventFilters = {
  eventType?: string
  format?: string
  stage?: string
}

/**
 * Same discipline as src/server/content/programs.ts: overrideAccess:false and
 * no user context, so a draft event can never leak onto the public site
 * through this layer regardless of what calls it.
 */

/** Empty means empty; failure throws (KN-01 / KN-21). No invented events. */
async function listEventsUncached(filters: EventFilters = {}) {
  const payload = await getContentClient()

  const where: Where = { and: [] }
  const and = where.and as Where[]
  if (filters.eventType) and.push({ eventType: { equals: filters.eventType } })
  if (filters.format) and.push({ format: { equals: filters.format } })
  if (filters.stage) and.push({ relevantStages: { equals: filters.stage } })

  const result = await payload.find({
    collection: 'events',
    where: and.length > 0 ? where : undefined,
    depth: 1,
    limit: 100,
    sort: 'startsAt',
    overrideAccess: false,
  })

  return result.docs
}

/** Empty means empty; failure throws (KN-01). The "upcoming" list used to substitute two invented events. */
async function listUpcomingEventsUncached(filters: EventFilters = {}) {
  const payload = await getContentClient()

  // Still "upcoming" while it is running: an event with an end time stays listed until
  // that time passes; one without an end time is listed until it starts.
  const now = new Date().toISOString()
  const where: Where = {
    and: [
      {
        or: [
          { endsAt: { greater_than: now } },
          { and: [{ endsAt: { exists: false } }, { startsAt: { greater_than: now } }] },
        ],
      },
    ],
  }
  const and = where.and as Where[]
  if (filters.eventType) and.push({ eventType: { equals: filters.eventType } })
  if (filters.format) and.push({ format: { equals: filters.format } })
  if (filters.stage) and.push({ relevantStages: { equals: filters.stage } })

  const result = await payload.find({
    collection: 'events',
    where,
    depth: 1,
    limit: 100,
    sort: 'startsAt',
    overrideAccess: false,
  })

  return result.docs
}

async function getEventByIdUncached(id: number): Promise<Event | null> {
  try {
    const payload = await getContentClient()
    return await payload.findByID({ collection: 'events', id, depth: 1, overrideAccess: false })
  } catch (error) {
    // A missing event is null; anything else must not be cached as "missing".
    const status = (error as { status?: number } | null)?.status
    if (status === 404 || status === 403) return null
    throw error
  }
}

async function getEventBySlugUncached(slug: string): Promise<Event | null> {
  try {
    const payload = await getContentClient()

    const result = await payload.find({
      collection: 'events',
      where: { slug: { equals: slug } },
      depth: 2,
      limit: 1,
      overrideAccess: false,
    })

    return result?.docs?.[0] ?? null
  } catch (error) {
    // Rethrown so the cache never remembers a failure; the exported reader below turns it into null.
    throw error
  }
}

/** Events matching a stage/interest set, for dashboard recommendations (7-9.9). Falls back to any upcoming event if nothing matches — a near-match beats an empty dashboard. */
async function listRecommendedEventsUncached(stage: string | null, limit = 3) {
  const matched = stage ? await listUpcomingEvents({ stage }) : []
  if (matched.length >= limit || !stage) return matched.slice(0, limit)

  const fallback = await listUpcomingEvents()
  const matchedIds = new Set(matched.map((e) => e.id))
  const filler = fallback.filter((e) => !matchedIds.has(e.id))
  return [...matched, ...filler].slice(0, limit)
}

// Shared by every visitor and expired on any CMS change: see ./cache.ts.
export const listEvents = cachedRead('events.listEvents', listEventsUncached)
export const listUpcomingEvents = cachedRead('events.listUpcomingEvents', listUpcomingEventsUncached)
export const getEventBySlug = cachedReadOr('events.getEventBySlug', getEventBySlugUncached, null)
export const getEventById = cachedReadOr('events.getEventById', getEventByIdUncached, null)
export const listRecommendedEvents = cachedRead('events.listRecommendedEvents', listRecommendedEventsUncached)
