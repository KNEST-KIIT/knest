import { getContentClient } from './payload-client'
import { cachedRead } from './cache'

/**
 * Articles where `startup` is set: founder stories, for /invest (section 4.6).
 * No article detail route exists yet.
 *
 * Empty means empty; failure throws (KN-01). This module used to substitute six
 * invented, bylined articles for either case.
 */
async function listFounderArticlesUncached(limit = 6) {
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

/** One published article by slug, or null. A draft or missing article is null, never an error. */
async function getArticleBySlugUncached(slug: string) {
  const payload = await getContentClient()
  const result = await payload.find({
    collection: 'articles',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    overrideAccess: false,
  })
  return result.docs[0] ?? null
}

async function listArticlesUncached(limit = 12) {
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

// Shared by every visitor and expired on any CMS change: see ./cache.ts.
export const listFounderArticles = cachedRead('articles.listFounderArticles', listFounderArticlesUncached)
export const getArticleBySlug = cachedRead('articles.getArticleBySlug', getArticleBySlugUncached)
export const listArticles = cachedRead('articles.listArticles', listArticlesUncached)
