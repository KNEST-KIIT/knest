import type { MetadataRoute } from 'next'
import { listPrograms } from '@/server/content/programs'
import { listStartups } from '@/server/content/startups'
import { listUpcomingEvents } from '@/server/content/events'
import { listResources } from '@/server/content/resources'
import { listMentors } from '@/server/content/mentors'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/** Every public route that isn't behind a login and isn't a slug. */
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/programs', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/events', priority: 0.9, changeFrequency: 'daily' },
  { path: '/startups', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/mentors', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/resources', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/ecosystem', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/invest', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/search', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
]

/**
 * The site had no sitemap and no robots rules at all, so everything a
 * crawler knew about KNEST it had to find by following links — and the
 * signed-in half of the app (dashboard, apply, onboarding, admin) had
 * nothing telling crawlers to stay out of it.
 *
 * Content URLs are read through the same `overrideAccess: false` services
 * the pages use, so a draft program cannot reach the sitemap even though a
 * sitemap is generated server-side with no visitor attached.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programs, startups, events, resources, mentors] = await Promise.all([
    listPrograms(),
    listStartups(),
    listUpcomingEvents(),
    listResources(),
    listMentors(),
  ])

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${BASE}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  function add(prefix: string, docs: { slug?: string | null; updatedAt?: string | null }[], priority: number) {
    for (const doc of docs) {
      if (!doc.slug) continue
      entries.push({
        url: `${BASE}${prefix}/${doc.slug}`,
        lastModified: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
        changeFrequency: 'monthly',
        priority,
      })
    }
  }

  add('/programs', programs, 0.8)
  add('/startups', startups, 0.7)
  add('/events', events, 0.7)
  add('/mentors', mentors, 0.6)
  // An externally-hosted resource has no page of its own — its card links
  // straight out — so only hosted ones belong here.
  add('/resources', resources.filter((r) => Boolean(r.body)), 0.6)

  return entries
}
