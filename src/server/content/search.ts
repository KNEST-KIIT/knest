import { getContentClient } from './payload-client'

export type SearchResultType = 'program' | 'startup' | 'mentor' | 'event' | 'resource'

export type SearchResult = {
  type: SearchResultType
  id: number
  title: string
  summary: string
  href: string
}

/**
 * Real search against the actual Postgres tables through Payload's own
 * `contains` operator (Drizzle `ilike`, auto-wrapped with `%...%` —
 * confirmed via @payloadcms/drizzle's sanitizeQueryValue, not just assumed
 * from the operator's name), not a client-side filter over an
 * already-fetched list. `overrideAccess: false` on every query, same
 * discipline as every other content-layer read — a draft never appears.
 *
 * Mentors are included because the contract's site-wide search covers
 * programmes, startups, mentors, events and resources (module 19), even though the
 * mentor directory also has its own expertise filter. Partners are not searched.
 */
export async function search(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const payload = await getContentClient()

  const [programs, startups, mentors, events, resources] = await Promise.all([
    payload.find({
      collection: 'programs',
      where: { or: [{ title: { contains: trimmed } }, { tagline: { contains: trimmed } }] },
      depth: 0,
      limit: 20,
      sort: '-createdAt',
      overrideAccess: false,
    }),
    payload.find({
      collection: 'startups',
      where: { or: [{ name: { contains: trimmed } }, { tagline: { contains: trimmed } }] },
      depth: 0,
      limit: 20,
      sort: '-createdAt',
      overrideAccess: false,
    }),
    payload.find({
      collection: 'mentors',
      where: { or: [{ name: { contains: trimmed } }, { title: { contains: trimmed } }, { organization: { contains: trimmed } }, { bio: { contains: trimmed } }] },
      depth: 0,
      limit: 20,
      sort: '-createdAt',
      overrideAccess: false,
    }),
    payload.find({
      collection: 'events',
      where: { or: [{ title: { contains: trimmed } }, { summary: { contains: trimmed } }] },
      depth: 0,
      limit: 20,
      sort: '-createdAt',
      overrideAccess: false,
    }),
    payload.find({
      collection: 'resources',
      where: { or: [{ title: { contains: trimmed } }, { summary: { contains: trimmed } }] },
      depth: 0,
      limit: 20,
      sort: '-createdAt',
      overrideAccess: false,
    }),
  ])

  // Collection order reflects the funnel's own priority (programs first,
  // resources last) — each collection's own results are already sorted by
  // recency via the query above.
  const results: SearchResult[] = [
    ...programs.docs.map((p) => ({
      type: 'program' as const,
      id: p.id,
      title: p.title,
      summary: p.tagline,
      href: `/programs/${p.slug}`,
    })),
    ...startups.docs.map((s) => ({
      type: 'startup' as const,
      id: s.id,
      title: s.name,
      summary: s.tagline,
      href: `/startups/${s.slug}`,
    })),
    ...mentors.docs.map((m) => ({
      type: 'mentor' as const,
      id: m.id,
      title: m.name,
      summary: [m.title, m.organization].filter(Boolean).join(', '),
      href: `/mentors/${m.slug}`,
    })),
    ...events.docs.map((e) => ({
      type: 'event' as const,
      id: e.id,
      title: e.title,
      summary: e.summary,
      href: `/events/${e.slug}`,
    })),
    ...resources.docs.map((r) => ({
      type: 'resource' as const,
      id: r.id,
      title: r.title,
      summary: r.summary,
      // Hosted-only, same as /resources' own card links (7-9.4) — an
      // external-only resource has no /resources/[slug] route.
      href: r.body ? `/resources/${r.slug}` : r.externalUrl || '#',
    })),
  ]

  // Exact-title match first, otherwise the collection-priority order above.
  const lowerQuery = trimmed.toLowerCase()
  return results
    .map((result, index) => ({ result, index, exact: result.title.toLowerCase() === lowerQuery }))
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1
      return a.index - b.index
    })
    .map(({ result }) => result)
}
