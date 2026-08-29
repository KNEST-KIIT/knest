import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { listStartups, type StartupFilters as Filters } from '@/server/content/startups'
import { StartupFilters } from './filters'

export const metadata: Metadata = {
  title: 'Startups',
  description: "KNEST's ventures, and the arc each one has walked so far.",
}

function resultSummary(count: number, hasFilters: boolean): string {
  if (count === 0) return hasFilters ? 'No startups match that combination.' : 'No startups yet.'
  return `${count} startup${count === 1 ? '' : 's'}${hasFilters ? ' match your filters' : ''}.`
}

async function StartupsList({ filters }: { filters: Filters }) {
  const startups = await listStartups(filters)
  const hasFilters = Object.values(filters).some(Boolean)
  const summary = resultSummary(startups.length, hasFilters)

  if (startups.length === 0 && hasFilters) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState heading="No matches" body="No startups match that combination yet. Try widening one filter." />
      </>
    )
  }

  if (startups.length === 0) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState
          heading="THE FIRST GENERATION IS BEING BUILT."
          body="KNEST's first ventures are taking shape now. Their stories will be here. If you'd like one of them to be yours, this is the moment to start."
        />
      </>
    )
  }

  return (
    <>
      <LiveRegion message={summary} />
      <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {startups.map((startup) => (
          <LinkCard key={startup.id} href={`/startups/${startup.slug}`} label={`View ${startup.name}`}>
            {startup.stage && <Tag tone="signal">{startup.stage}</Tag>}
            <Heading as="h3" size="heading" className="mt-4">
              {startup.name}
            </Heading>
            <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{startup.tagline}</p>
            <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
              View startup →
            </span>
          </LinkCard>
        ))}
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
  const filters: Filters = { stage: params.stage, sector: params.sector }

  return (
    <Section>
      <Heading as="h1" size="display">
        Built with KNEST.
      </Heading>
      <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
        Every startup here walked the same path: a problem worth solving, an idea worth testing,
        and the work it takes to turn that into something real.
      </p>

      <div className="mt-10">
        <Suspense>
          <StartupFilters />
        </Suspense>
      </div>

      <div className="mt-10">
        <StartupsList filters={filters} />
      </div>
    </Section>
  )
}
