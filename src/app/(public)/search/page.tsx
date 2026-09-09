import type { Metadata } from 'next'
import Link from 'next/link'
import { Button, EmptyState, Heading, Input, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { PageHero } from '@/components/layout/page-hero'
import { resultSummary } from '@/lib/result-summary'
import { searchEmpty } from '@/lib/empty-state-copy'
import { search, type SearchResultType } from '@/server/content/search'
import { track } from '@/server/analytics/track'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search across KNEST’s programs, startups, events and resources at once.',
}

const TYPE_LABELS: Record<SearchResultType, string> = {
  program: 'Program',
  startup: 'Startup',
  event: 'Event',
  resource: 'Resource',
}

/** Where a visitor who searched and found nothing should go instead — the four things worth browsing whole. */
const BROWSE = [
  { href: '/programs', label: 'Programs', body: 'Cohort programs, sorted by the stage they are built for.' },
  { href: '/events', label: 'Events', body: 'Workshops, talks and demo days you can attend without applying to anything.' },
  { href: '/resources', label: 'Resources', body: 'Guides, templates and playbooks filed by stage.' },
  { href: '/startups', label: 'Startups', body: 'Ventures built through KNEST, and how each one got there.' },
]

function BrowseInstead({ heading }: { heading: string }) {
  return (
    <div>
      <Heading as="h2" size="heading">
        {heading}
      </Heading>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {BROWSE.map((item) => (
          <LinkCard key={item.href} href={item.href} label={`Browse ${item.label}`}>
            <Heading as="h3" size="heading">
              {item.label}
            </Heading>
            <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{item.body}</p>
          </LinkCard>
        ))}
      </div>
    </div>
  )
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
        <div className="mt-12">
          <BrowseInstead heading="Browse instead" />
        </div>
      </>
    )
  }

  return (
    <>
      <LiveRegion message={summary} />
      <p className="mb-6 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {results.map((result) => (
          <LinkCard
            key={`${result.type}-${result.id}`}
            href={result.href}
            label={`${TYPE_LABELS[result.type]}: ${result.title}`}
          >
            <Tag tone="archive">{TYPE_LABELS[result.type]}</Tag>
            <Heading as="h3" size="heading" className="mt-4">
              {result.title}
            </Heading>
            <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
              {result.summary}
            </p>
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
    <>
      <PageHero
        eyebrow="Search"
        title="Look across all of it."
        lede="Programs, startups, events and resources — one search, no tabs to choose between first."
      />

      <Section padding="top">
        <form action="/search" method="get" className="flex max-w-[640px] gap-3">
          <Input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Try “validation”, “fundraising”, “demo day”"
            aria-label="Search KNEST"
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </form>

        <div className="mt-10">
          {query ? (
            <SearchResults query={query} />
          ) : (
            <BrowseInstead heading="Or start from one of these" />
          )}
        </div>

        <p className="mt-12 max-w-[56ch] text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          Looking for a person rather than a page? Mentors have their own{' '}
          <Link href="/mentors" className="underline underline-offset-2">
            directory
          </Link>
          , and anything else goes to{' '}
          <Link href="/about#contact" className="underline underline-offset-2">
            the team
          </Link>
          .
        </p>
      </Section>
    </>
  )
}
