import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { formatDate } from '@/lib/dates'
import { resultSummary } from '@/lib/result-summary'
import { PROGRAMS_EMPTY } from '@/lib/empty-state-copy'
import { listPrograms, type ProgramFilters as Filters } from '@/server/content/programs'
import { ProgramFilters } from './filters'
import { ProgramStatusBadge } from './program-status-badge'

export const metadata: Metadata = {
  title: 'Programs',
  description: 'Stage-gated venture creation programs at KNEST. Start with where you actually are.',
}

async function ProgramsList({ filters }: { filters: Filters }) {
  const programs = await listPrograms(filters)
  const hasFilters = Object.values(filters).some(Boolean)
  const summary = resultSummary(programs.length, 'program', { hasFilters, emptyNoFilters: 'No programs yet.' })

  if (programs.length === 0 && hasFilters) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState
          heading="No matches"
          body="No programs match that combination yet. Try widening one filter."
        />
      </>
    )
  }

  if (programs.length === 0) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState {...PROGRAMS_EMPTY} />
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
        {programs.map((program) => (
          <LinkCard key={program.id} href={`/programs/${program.slug}`} label={`View ${program.title}`}>
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <ProgramStatusBadge status={program.applicationStatus} />
              {program.stage && program.stage.length > 0 && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-signal)] font-semibold">
                  {program.stage[0]}
                </span>
              )}
            </div>

            <Heading as="h2" size="heading" className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
              {program.title}
            </Heading>
            
            <p className="mt-2 text-sm text-[var(--color-ink-soft)] font-light line-clamp-2 leading-relaxed">
              {program.tagline}
            </p>

            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-line)]/60 pt-4 text-xs text-[var(--color-ink-muted)] font-mono">
              {program.duration && <span>Duration: {program.duration}</span>}
              {program.nextCohortStart && <span>Cohort: {formatDate(program.nextCohortStart)}</span>}
            </div>

            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--color-signal)]">
              View Program Details →
            </span>
          </LinkCard>
        ))}
      </div>
    </>
  )
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const filters: Filters = {
    stage: params.stage,
    sector: params.sector,
    audience: params.audience,
    format: params.format,
    status: params.status,
  }

  return (
    <div>
      <PageHeader
        kicker="Venture Curriculum"
        title="Find Where You Fit."
        description="Every program is engineered for a specific stage of venture development. Start with where you actually are, not where you think you should be."
        imageSrc="/images/stage_01_exploring.jpg"
        imageAlt="KNEST Programs"
        badgeText="Experiential Learning · Stage-Gated Curriculum"
      />

      <Section className="py-8 md:py-10">
        <div className="border-b border-[var(--color-line)] pb-5">
          <Suspense>
            <ProgramFilters />
          </Suspense>
        </div>

        <div className="mt-6">
          <ProgramsList filters={filters} />
        </div>
      </Section>
    </div>
  )
}
