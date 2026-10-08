import { getContentClient } from './payload-client'

/**
 * Articles where `startup` is set: founder stories, for /invest (section 4.6).
 * No article detail route exists yet.
 *
 * Empty means empty; failure throws (KN-01). This module used to substitute six
 * invented, bylined articles for either case.
 */
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

export async function listArticles(limit = 12) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'articles',
    depth: 1,
    limit,
    sort: '-publishedAt',
    overrideAccess: false,
  })

  return result.docs
}
