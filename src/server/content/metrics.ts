import { getContentClient } from './payload-client'

/**
 * Ecosystem numbers. The collection requires `asOf` and `source` on every
 * entry precisely so a published figure can always be traced (spec §46), and
 * the rendering side honours the split the collection describes: `asOf` is
 * shown to the visitor, `source` is an internal note and stays internal.
 *
 * Nothing read this collection before — the doc comment says "shown on the
 * homepage", but no page ever queried it.
 */
export async function listMetrics(limit = 12) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'metrics',
    depth: 0,
    limit,
    sort: 'order',
    overrideAccess: false,
  })

  return result.docs
}
