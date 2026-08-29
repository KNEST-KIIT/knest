import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Resource } from '@/payload/payload-types'

export type ResourceFilters = {
  stage?: string
  format?: string
}

export async function listResources(filters: ResourceFilters = {}) {
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

  return result.docs
}

export async function getResourceBySlug(slug: string): Promise<Resource | null> {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'resources',
    // Hosted-only: an externally-hosted resource (body empty, externalUrl set)
    // never gets a /resources/[slug] route — its card links straight out —
    // so this excludes it here rather than the page having to redirect.
    where: { and: [{ slug: { equals: slug } }, { body: { exists: true } }] },
    depth: 1,
    limit: 1,
    overrideAccess: false,
  })

  return result.docs[0] ?? null
}

/** Resources matching a stage, for dashboard recommendations (7-9.9). */
export async function listRecommendedResources(stage: string | null, limit = 3) {
  if (!stage) return []
  const matched = await listResources({ stage })
  return matched.slice(0, limit)
}
