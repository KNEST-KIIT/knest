import { getContentClient } from './payload-client'
import { cachedReadOr } from './cache'

/** Same discipline as the rest of src/server/content: overrideAccess:false, no user context. No `featured` field exists on Partners — this returns every published partner. */
async function listPartnersUncached(limit = 30) {
  try {
    const payload = await getContentClient()

    const result = await payload.find({
      collection: 'partners',
      depth: 1,
      limit,
      sort: 'name',
      overrideAccess: false,
    })

    return result?.docs || []
  } catch (error) {
    // Rethrown so the cache never remembers a failure; the exported reader below turns it into [].
    throw error
  }
}

// Shared by every visitor and expired on any CMS change: see ./cache.ts.
export const listPartners = cachedReadOr('partners.listPartners', listPartnersUncached, [])
