import { getContentClient } from './payload-client'

/** Articles where `startup` is set — founder stories, for /invest (§4.6). No article detail route exists yet: each card links to the linked startup's own profile, where its story arc actually lives. */
export async function listFounderArticles(limit = 6) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'articles',
    where: { startup: { exists: true } },
    depth: 1,
    limit,
    sort: '-publishedAt',
    overrideAccess: false,
  })

  return result.docs
}
