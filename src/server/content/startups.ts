import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Startup } from '@/payload/payload-types'
import { cachedRead, cachedReadOr } from './cache'

export type StartupFilters = {
  stage?: string
  sector?: string
}

/** Same discipline as the rest of src/server/content: overrideAccess:false, no user context. */
/**
 * Empty means empty (KN-01): no rows returns [] so the page renders its honest
 * empty state, and a failure throws so the route's error boundary shows an
 * honest error. Substituting invented startups for either is what this module
 * used to do.
 */
async function listStartupsUncached(filters: StartupFilters = {}) {
  const payload = await getContentClient()

  const where: Where = { and: [] }
  const and = where.and as Where[]
  if (filters.stage) and.push({ stage: { equals: filters.stage } })
  if (filters.sector) and.push({ sectors: { equals: filters.sector } })

  const result = await payload.find({
    collection: 'startups',
    where: and.length > 0 ? where : undefined,
    depth: 1,
    limit: 100,
    sort: '-createdAt',
    overrideAccess: false,
  })

  return result.docs
}

/** Startups.featured, for the homepage and /invest showcases — no filter beyond featured itself. */
async function listFeaturedStartupsUncached(limit = 6) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'startups',
    where: { featured: { equals: true } },
    depth: 1,
    limit,
    sort: '-createdAt',
    overrideAccess: false,
  })

  return result.docs
}

async function getStartupBySlugUncached(slug: string): Promise<Startup | null> {
  try {
    const payload = await getContentClient()

    const result = await payload.find({
      collection: 'startups',
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

/**
 * Resolves the public startup linked to a platform user via their editorial
 * Founder profile (Founders.userId -> Startups.founders).
 */
export async function getStartupForUser(userId: string): Promise<Startup | null> {
  try {
    const payload = await getContentClient()

    // 1. Find the editorial founder profile pointing to this platform user
    const foundersResult = await payload.find({
      collection: 'founders',
      where: { userId: { equals: userId } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })

    const founder = foundersResult?.docs?.[0]
    if (!founder) return null

    // 2. Find the startup whose founders relationship contains this founder
    const startupsResult = await payload.find({
      collection: 'startups',
      where: {
        founders: {
          in: [founder.id],
        },
      },
      depth: 2,
      limit: 1,
      sort: '-createdAt',
      overrideAccess: false,
    })

    return startupsResult?.docs?.[0] ?? null
  } catch (error) {
    console.warn('Could not fetch startup for user:', error)
    return null
  }
}

// Shared by every visitor and expired on any CMS change: see ./cache.ts.
export const listStartups = cachedRead('startups.listStartups', listStartupsUncached)
export const listFeaturedStartups = cachedRead('startups.listFeaturedStartups', listFeaturedStartupsUncached)
export const getStartupBySlug = cachedReadOr('startups.getStartupBySlug', getStartupBySlugUncached, null)
