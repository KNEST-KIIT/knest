import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Event } from '@/payload/payload-types'

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

export async function listEvents(filters: EventFilters = {}) {
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

/** Only events that haven't started yet — the list a visitor actually wants to see. */
export async function listUpcomingEvents(filters: EventFilters = {}) {
  const payload = await getContentClient()

  const where: Where = { and: [{ startsAt: { greater_than: new Date().toISOString() } }] }
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

export async function getEventById(id: number): Promise<Event | null> {
  const payload = await getContentClient()
  try {
    return await payload.findByID({ collection: 'events', id, depth: 1, overrideAccess: false })
  } catch {
    return null
  }
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'events',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: false,
  })

  return result.docs[0] ?? null
}

/** Events matching a stage/interest set, for dashboard recommendations (7-9.9). Falls back to any upcoming event if nothing matches — a near-match beats an empty dashboard. */
export async function listRecommendedEvents(stage: string | null, limit = 3) {
  const matched = stage ? await listUpcomingEvents({ stage }) : []
  if (matched.length >= limit || !stage) return matched.slice(0, limit)

  const fallback = await listUpcomingEvents()
  const matchedIds = new Set(matched.map((e) => e.id))
  const filler = fallback.filter((e) => !matchedIds.has(e.id))
  return [...matched, ...filler].slice(0, limit)
}
