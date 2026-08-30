import { getContentClient } from './payload-client'

export type SearchResultType = 'program' | 'startup' | 'event' | 'resource'

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
 * Mentors and Partners are deliberately excluded — both are already
 * need-first/browse-first surfaces by design (PHASE-7-9-IMPLEMENTATION-
 * PLAN.md §4.5/§4.6); a name-substring search over a small, staff-curated
 * directory would be a second, worse way to find the same thing the
 * expertise filter already does well.
 */
export async function search(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const payload = await getContentClient()

  const [programs, startups, events, resources] = await Promise.all([
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
