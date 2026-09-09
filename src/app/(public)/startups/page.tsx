import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ButtonLink, EmptyState, FilterBar, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { PageHero } from '@/components/layout/page-hero'
import { resultSummary } from '@/lib/result-summary'
import { STARTUPS_EMPTY } from '@/lib/empty-state-copy'
import { applyFacets, deriveFacets, hasActiveFacets, type FacetSource } from '@/lib/facets'
import { sectorLabel, stageLabel } from '@/lib/labels'
import { SECTOR_OPTIONS, STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import { listStartups } from '@/server/content/startups'
import type { Startup } from '@/payload/payload-types'

export const metadata: Metadata = {
  title: 'Startups',
  description: 'The ventures built through KNEST, and the arc each one has walked so far.',
}

/** Stage and sector are the two questions anyone actually asks of a venture list — and both stay hidden until enough startups exist for the answer to differ (src/lib/facets.ts). */
const FACETS: readonly FacetSource<Startup>[] = [
  { key: 'stage', label: 'Stage', options: STAGE_OPTIONS, valuesOf: (s) => s.stage },
  { key: 'sector', label: 'Sector', options: SECTOR_OPTIONS, valuesOf: (s) => s.sectors },
]

const HOW_LISTING_WORKS = [
  {
    title: 'It has to be real',
    body: 'A venture appears here once it exists outside a slide — a product people use, a service people pay for, or research on its way to becoming one of those.',
  },
  {
    title: 'The arc is the story',
    body: 'Each profile shows where the venture started and what changed, including the parts that did not work. A founder page that reads like a press release helps nobody who is two years behind them.',
  },
  {
    title: 'KNEST has to have mattered',
    body: 'A program, a mentor, a lab, an introduction. If KNEST was not part of it, the venture belongs on its own site rather than ours.',
  },
]

async function StartupsList({ params }: { params: Record<string, string | undefined> }) {
  const all = await listStartups()
  const startups = applyFacets(all, FACETS, params)
  const facets = deriveFacets(all, FACETS, params)
  const hasFilters = hasActiveFacets(FACETS, params)
  const summary = resultSummary(startups.length, 'startup', {
    hasFilters,
    emptyNoFilters: 'No startups listed yet.',
  })

  return (
    <>
      <Suspense>
        <FilterBar basePath="/startups" filters={facets} label="Filter startups" />
      </Suspense>

      <div className={facets.length > 0 ? 'mt-10' : ''}>
        <LiveRegion message={summary} />

        {startups.length === 0 && hasFilters ? (
          <EmptyState
            heading="Nothing matches that yet"
            body="No venture fits that combination right now. Widen a filter and you will see more."
            action={<ButtonLink href="/startups" variant="secondary">Clear filters</ButtonLink>}
          />
        ) : startups.length === 0 ? (
          <EmptyState {...STARTUPS_EMPTY} action={<ButtonLink href="/programs">Start yours</ButtonLink>} />
        ) : (
          <>
            <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {startups.map((startup) => (
                <LinkCard key={startup.id} href={`/startups/${startup.slug}`} label={`View ${startup.name}`}>
                  {startup.stage && <Tag tone="signal">{stageLabel(startup.stage)}</Tag>}
                  <Heading as="h2" size="heading" className="mt-4">
                    {startup.name}
                  </Heading>
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {startup.tagline}
                  </p>
                  {startup.sectors && startup.sectors.length > 0 && (
                    <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                      {startup.sectors.map(sectorLabel).join(' · ')}
                    </p>
                  )}
                  <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
                    Read the story →
                  </span>
                </LinkCard>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default async function StartupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams

  return (
    <>
      <PageHero
        eyebrow="Startups"
        title="Built with KNEST."
        image="/images/stage_scaling.jpg"
        lede="Every venture here walked the same path: a problem worth solving, an idea worth testing, and the unglamorous work of turning that into something real."
      />

      <Section padding="top">
        <StartupsList params={params} />
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          What gets listed here
        </Heading>
        <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
          This page is a record, not a showcase. Three things have to be true before a venture appears on
          it.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {HOW_LISTING_WORKS.map((entry) => (
            <div
              key={entry.title}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6"
            >
              <Heading as="h3" size="heading">
                {entry.title}
              </Heading>
              <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                {entry.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 md:p-10">
          <Heading as="h2" size="heading">
            Want your name on this page?
          </Heading>
          <p className="mt-3 max-w-[56ch] text-[var(--color-ink-soft)]">
            Nobody on it started with more than you have. Find the program that matches your stage, or
            come to an event first and decide afterwards.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/programs">Browse programs</ButtonLink>
            <ButtonLink href="/events" variant="secondary">
              See what&rsquo;s on
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  )
}
