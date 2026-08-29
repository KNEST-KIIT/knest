import type { Where } from 'payload'
import { getContentClient } from './payload-client'
import type { Mentor } from '@/payload/payload-types'

export type MentorFilters = {
  expertise?: string
}

const AVAILABILITY_ORDER: Record<string, number> = { open: 0, limited: 1, unavailable: 2 }

function availabilityRank(mentor: Mentor): number {
  return mentor.availability ? (AVAILABILITY_ORDER[mentor.availability] ?? 1) : 1
}

function byAvailability(a: Mentor, b: Mentor): number {
  return availabilityRank(a) - availabilityRank(b)
}

/**
 * Same discipline as the rest of src/server/content: overrideAccess:false,
 * no user context. Ordered open → limited → unavailable — an unavailable
 * mentor is still returned (never hidden), just ranked last, matching the
 * collection's own "honest over hiding" design intent.
 */
export async function listMentors(filters: MentorFilters = {}) {
  const payload = await getContentClient()

  const where: Where = { and: [] }
  const and = where.and as Where[]
  if (filters.expertise) and.push({ expertise: { equals: filters.expertise } })

  const result = await payload.find({
    collection: 'mentors',
    where: and.length > 0 ? where : undefined,
    depth: 1,
    limit: 100,
    overrideAccess: false,
  })

  return [...result.docs].sort(byAvailability)
}

/**
 * Resolves a signed-in mentor's own public profile via Mentors.userId
 * (dashboard §4.1). A signed-in mentor account does not automatically have a
 * published Mentor document — staff review before publishing — so this can
 * legitimately return null; the caller renders an honest empty state rather
 * than treating it as an error.
 */
export async function getMentorByUserId(userId: string): Promise<Mentor | null> {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'mentors',
    where: { userId: { equals: userId } },
    depth: 1,
    limit: 1,
    overrideAccess: false,
  })

  return result.docs[0] ?? null
}

export async function getMentorBySlug(slug: string): Promise<Mentor | null> {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'mentors',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    overrideAccess: false,
  })

  return result.docs[0] ?? null
}
