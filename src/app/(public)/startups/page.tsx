import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { resultSummary } from '@/lib/result-summary'
import { STARTUPS_EMPTY } from '@/lib/empty-state-copy'
import { listStartups, type StartupFilters as Filters } from '@/server/content/startups'
import { StartupFilters } from './filters'

export const metadata: Metadata = {
  title: 'Startups',
  description: "KNEST's student-founded ventures, and the empirical arc each one has walked.",
}

async function StartupsList({ filters }: { filters: Filters }) {
  const startups = await listStartups(filters)
  const hasFilters = Object.values(filters).some(Boolean)
  const summary = resultSummary(startups.length, 'startup', { hasFilters, emptyNoFilters: 'No startups yet.' })

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
        <EmptyState {...STARTUPS_EMPTY} />
      </>
    )
  }

  return (
    <>
      <LiveRegion message={summary} />
      <p className="mb-6 font-mono text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
        Showing {summary}
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {startups.map((startup) => (
          <LinkCard key={startup.id} href={`/startups/${startup.slug}`} label={`View ${startup.name}`}>
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              {startup.stage ? (
                <Tag tone="signal">{startup.stage}</Tag>
              ) : (
                <span className="font-mono text-xs text-[var(--color-ink-muted)]">Active</span>
              )}
              {startup.sectors && startup.sectors.length > 0 && (
                <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-ink-muted)]">
                  {startup.sectors[0]}
                </span>
              )}
            </div>

            <Heading as="h2" size="heading" className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
              {startup.name}
            </Heading>
            
            <p className="mt-2 text-sm text-[var(--color-ink-soft)] font-light leading-relaxed line-clamp-2">
              {startup.tagline}
            </p>

            <span className="mt-6 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--color-signal)]">
              Venture Profile →
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
    <div>
      <PageHeader
        kicker="Venture Directory"
        title="Built with KNEST."
        description="Every startup here walked the same path: a real problem worth solving, an idea tested against empirical reality, and the infrastructure to scale."
        imageSrc="/images/stage_scaling.jpg"
        imageAlt="KNEST Startups"
        badgeText="Venture Portfolio · Student Founders"
      />

      <Section className="py-8 md:py-10">
        <div className="border-b border-[var(--color-line)] pb-5">
          <Suspense>
            <StartupFilters />
          </Suspense>
        </div>

        <div className="mt-6">
          <StartupsList filters={filters} />
        </div>
      </Section>
    </div>
  )
}
