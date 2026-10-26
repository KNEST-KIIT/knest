import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Startup } from '@/payload/payload-types'

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
export async function listStartups(filters: StartupFilters = {}) {
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
export async function listFeaturedStartups(limit = 6) {
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

export async function getStartupBySlug(slug: string): Promise<Startup | null> {
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
    console.warn('Could not fetch startup by slug:', error)
    return null
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
      overrideAccess: false,
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
