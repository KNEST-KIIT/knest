import { getContentClient } from './payload-client'

/** Same discipline as the rest of src/server/content: overrideAccess:false, no user context. No `featured` field exists on Partners — this returns every published partner. */
export async function listPartners(limit = 30) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'partners',
    depth: 1,
    limit,
    sort: 'name',
    overrideAccess: false,
  })

  return result.docs
}
