import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Resource } from '@/payload/payload-types'
import { cachedRead, cachedReadOr } from './cache'

export type ResourceFilters = {
  stage?: string
  format?: string
}

async function listResourcesUncached(filters: ResourceFilters = {}) {
  try {
    const payload = await getContentClient()

    const where: Where = { and: [] }
    const and = where.and as Where[]
    if (filters.stage) and.push({ stages: { equals: filters.stage } })
    if (filters.format) and.push({ format: { equals: filters.format } })

    const result = await payload.find({
      collection: 'resources',
      where: and.length > 0 ? where : undefined,
      depth: 1,
      limit: 100,
      sort: '-createdAt',
      overrideAccess: false,
    })

    return result?.docs || []
  } catch (error) {
    // Rethrown so the cache never remembers a failure; the exported reader below turns it into [].
    throw error
  }
}

async function getResourceBySlugUncached(slug: string): Promise<Resource | null> {
  try {
    const payload = await getContentClient()

    const result = await payload.find({
      collection: 'resources',
      where: {
        slug: { equals: slug },
      },
      depth: 1,
      limit: 1,
      overrideAccess: false,
    })

    const resource = result?.docs?.[0] ?? null
    if (!resource) return null

    // Purely external resources (no body and no file) do not have a dedicated detail route
    if (!resource.body && !resource.file) {
      return null
    }

    return resource
  } catch (error) {
    // Rethrown so the cache never remembers a failure; the exported reader below turns it into null.
    throw error
  }
}

/** Resources matching a stage, for dashboard recommendations (7-9.9). */
async function listRecommendedResourcesUncached(stage: string | null, limit = 3) {
  if (!stage) return []
  const matched = await listResources({ stage })
  return matched.slice(0, limit)
}

// Shared by every visitor and expired on any CMS change: see ./cache.ts.
export const listResources = cachedReadOr('resources.listResources', listResourcesUncached, [])
export const getResourceBySlug = cachedReadOr('resources.getResourceBySlug', getResourceBySlugUncached, null)
export const listRecommendedResources = cachedRead('resources.listRecommendedResources', listRecommendedResourcesUncached)
