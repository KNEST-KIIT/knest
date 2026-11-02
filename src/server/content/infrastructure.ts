import { getContentClient } from './payload-client'
import { cachedReadOr } from './cache'

/** Same discipline as the rest of src/server/content: overrideAccess:false, no user context. Showcase only — no booking. */
async function listInfrastructureUncached(limit = 20) {
  try {
    const payload = await getContentClient()

    const result = await payload.find({
      collection: 'infrastructure',
      depth: 1,
      limit,
      overrideAccess: false,
    })

    return result?.docs || []
  } catch (error) {
    // Rethrown so the cache never remembers a failure; the exported reader below turns it into [].
    throw error
  }
}

// Shared by every visitor and expired on any CMS change: see ./cache.ts.
export const listInfrastructure = cachedReadOr('infrastructure.listInfrastructure', listInfrastructureUncached, [])
