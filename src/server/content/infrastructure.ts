import { getContentClient } from './payload-client'

/** Same discipline as the rest of src/server/content: overrideAccess:false, no user context. Showcase only — no booking. */
export async function listInfrastructure(limit = 20) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'infrastructure',
    depth: 1,
    limit,
    overrideAccess: false,
  })

  return result.docs
}
