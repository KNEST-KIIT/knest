import type { Metadata } from 'next'
import { Button, EmptyState, Heading, Input, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { resultSummary } from '@/lib/result-summary'
import { searchEmpty } from '@/lib/empty-state-copy'
import { search, type SearchResultType } from '@/server/content/search'
import { track } from '@/server/analytics/track'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search programs, startups, events and resources.',
}

const TYPE_LABELS: Record<SearchResultType, string> = {
  program: 'Program',
  startup: 'Startup',
  event: 'Event',
  resource: 'Resource',
}

async function SearchResults({ query }: { query: string }) {
  const results = await search(query)
  await track('search_query', { query, resultCount: results.length })
  const empty = searchEmpty(query)
  const summary = resultSummary(results.length, 'result', {
    hasFilters: true,
    emptyNoFilters: empty.heading,
    emptyWithFilters: empty.heading,
    qualifier: '',
  })

  if (results.length === 0) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState {...empty} />
      </>
    )
  }

  return (
    <>
      <LiveRegion message={summary} />
      <p className="mb-6 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => (
          <LinkCard key={`${result.type}-${result.id}`} href={result.href} label={`${TYPE_LABELS[result.type]}: ${result.title}`}>
            <Tag tone="archive">{TYPE_LABELS[result.type]}</Tag>
            <Heading as="h3" size="heading" className="mt-4">
              {result.title}
            </Heading>
            <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{result.summary}</p>
          </LinkCard>
        ))}
      </div>
    </>
  )
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  return (
    <Section>
      <Heading as="h1" size="display">
        Search.
      </Heading>
      <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
        Programs, startups, events and resources — one search across all of it.
      </p>

      <form action="/search" method="get" className="mt-10 flex max-w-[480px] gap-3">
        <Input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search KNEST"
          aria-label="Search"
          className="flex-1"
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="mt-10">
        {query ? (
          <SearchResults query={query} />
        ) : (
          <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            Start typing to search across the whole site.
          </p>
        )}
      </div>
    </Section>
  )
}
