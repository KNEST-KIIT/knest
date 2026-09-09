import type { Where } from 'payload'
import { getContentClient } from './payload-client'

/**
 * Quotes, and only ones the person agreed to.
 *
 * `consentGiven` is filtered in the query rather than checked at the call
 * site: the collection marks it required, but a required checkbox is still a
 * boolean that can be false, and this is the one field where getting it wrong
 * publishes a named quote nobody agreed to. Every read of this collection
 * goes through here, so the filter cannot be forgotten by a future caller.
 */
export async function listTestimonials({
  programId,
  limit = 6,
}: { programId?: number; limit?: number } = {}) {
  const payload = await getContentClient()

  const and: Where[] = [{ consentGiven: { equals: true } }]
  if (programId) and.push({ program: { equals: programId } })

  const result = await payload.find({
    collection: 'testimonials',
    where: { and },
    depth: 1,
    limit,
    overrideAccess: false,
  })

  return result.docs
}
