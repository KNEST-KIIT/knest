import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Startup } from '@/payload/payload-types'

export type StartupFilters = {
  stage?: string
  sector?: string
}

/** Same discipline as the rest of src/server/content: overrideAccess:false, no user context. */
const FALLBACK_STARTUPS = [
  { id: 1, name: 'AeroDrive', slug: 'aerodrive', tagline: 'Autonomous drone delivery for rural healthcare.', stage: 'mvp', sectors: ['health'], featured: true, cohort: 'Cohort 1' },
  { id: 2, name: 'FinFlow', slug: 'finflow', tagline: 'API-first payroll for Indian MSMEs.', stage: 'idea', sectors: ['fintech'], featured: true, cohort: 'Cohort 2' },
]

export async function listStartups(filters: StartupFilters = {}) {
  try {
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

    if (result?.docs && result.docs.length > 0) return result.docs
  } catch (error) {
    console.warn('Could not fetch startups, using fallback:', error)
  }
  
  let fallback = FALLBACK_STARTUPS as unknown as Startup[]
  if (filters.stage) fallback = fallback.filter(s => s.stage === filters.stage)
  if (filters.sector) fallback = fallback.filter(s => s.sectors?.includes(filters.sector! as any))
  return fallback
}

/** Startups.featured, for the homepage and /invest showcases — no filter beyond featured itself. */
export async function listFeaturedStartups(limit = 6) {
  try {
    const payload = await getContentClient()

    const result = await payload.find({
      collection: 'startups',
      where: { featured: { equals: true } },
      depth: 1,
      limit,
      sort: '-createdAt',
      overrideAccess: false,
    })

    if (result?.docs && result.docs.length > 0) return result.docs
  } catch (error) {
    console.warn('Could not fetch featured startups, using fallback:', error)
  }
  return FALLBACK_STARTUPS.filter(s => s.featured).slice(0, limit) as unknown as Startup[]
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
