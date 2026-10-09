import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site-url'
import { listArticles } from '@/server/content/articles'
import { listEvents } from '@/server/content/events'
import { listMentors } from '@/server/content/mentors'
import { listPrograms } from '@/server/content/programs'
import { listResources } from '@/server/content/resources'
import { listStartups } from '@/server/content/startups'

/** Generated when requested, so a newly published page appears without a rebuild. */
export const dynamic = 'force-dynamic'

/** Public pages only. The privacy notice and terms are left out until KIIT approves their text. */
const STATIC_PATHS = ['/', '/about', '/programs', '/events', '/mentors', '/startups', '/resources', '/blog', '/ecosystem', '/invest', '/get-involved', '/contact']

async function safely<T>(label: string, load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load()
  } catch (error) {
    // The static pages are still listed; a content outage must not turn the sitemap into an error.
    console.error(`sitemap: could not list ${label}:`, error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programs, events, mentors, startups, resources, articles] = await Promise.all([
    safely('programs', () => listPrograms()),
    safely('events', () => listEvents()),
    safely('mentors', () => listMentors()),
    safely('startups', () => listStartups()),
    safely('resources', () => listResources()),
    safely('articles', () => listArticles(500)),
  ])

  const dated = (path: string, updatedAt?: string | null) => ({
    url: absoluteUrl(path),
    ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
  })

  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    ...programs.map((p) => dated(`/programs/${p.slug}`, p.updatedAt)),
    ...events.map((e) => dated(`/events/${e.slug}`, e.updatedAt)),
    ...mentors.map((m) => dated(`/mentors/${m.slug}`, m.updatedAt)),
    ...startups.map((s) => dated(`/startups/${s.slug}`, s.updatedAt)),
    ...resources.filter((r) => r.body).map((r) => dated(`/resources/${r.slug}`, r.updatedAt)),
    ...articles.map((a) => dated(`/blog/${a.slug}`, a.updatedAt)),
  ]
}
