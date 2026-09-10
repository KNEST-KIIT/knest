import { getContentClient } from './payload-client'
import type { Article } from '@/payload/payload-types'

/** Articles where `startup` is set — founder stories, for /invest (§4.6) and the /stories index. */
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

/** Everything published, founder story or not — the /stories index. */
export async function listArticles(limit = 50) {
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

/** The stories written about one venture, shown on its own profile. */
export async function listArticlesForStartup(startupId: number, limit = 4) {
  const payload = await getContentClient()

  const result = await payload.find({
    collection: 'articles',
    where: { startup: { equals: startupId } },
    depth: 0,
    limit,
    sort: '-publishedAt',
    overrideAccess: false,
  })

  return result.docs
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
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
