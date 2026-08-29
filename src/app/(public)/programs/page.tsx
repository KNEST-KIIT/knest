import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState, Heading, LinkCard, LiveRegion, Section } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { listPrograms, type ProgramFilters as Filters } from '@/server/content/programs'
import { ProgramFilters } from './filters'
import { ProgramStatusBadge } from './program-status-badge'

export const metadata: Metadata = {
  title: 'Programs',
  description: 'Every program is built for a particular stage. Start with where you actually are.',
}

function resultSummary(count: number, hasFilters: boolean): string {
  if (count === 0) return hasFilters ? 'No programs match that combination.' : 'No programs yet.'
  return `${count} program${count === 1 ? '' : 's'}${hasFilters ? ' match your filters' : ''}.`
}

async function ProgramsList({ filters }: { filters: Filters }) {
  const programs = await listPrograms(filters)
  const hasFilters = Object.values(filters).some(Boolean)

  // A visible, announced result count (UX_WIREFRAMES.md §3 specified this —
  // "6 programs" next to the filter bar — and specified it be announced via
  // aria-live, since a client-side filter navigation updates the DOM without
  // a full page reload a screen reader would otherwise narrate on its own).
  const summary = resultSummary(programs.length, hasFilters)

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
        <EmptyState
          heading="Programs are being finalised."
          body="Applications open soon. Create an account and we'll tell you first."
        />
      </>
    )
  }

  return (
    <>
      {/* The visible summary is normal document content, read on a linear
          pass same as any text; the LiveRegion alongside it exists so that a
          filter change is announced even when focus hasn't moved here. */}
      <LiveRegion message={summary} />
      <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {programs.map((program) => (
          <LinkCard key={program.id} href={`/programs/${program.slug}`} label={`View ${program.title}`}>
            <ProgramStatusBadge status={program.applicationStatus} />
            <Heading as="h3" size="heading" className="mt-4">
              {program.title}
            </Heading>
            <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{program.tagline}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
              {program.duration && <span>{program.duration}</span>}
              {program.nextCohortStart && <span>Next: {formatDate(program.nextCohortStart)}</span>}
            </div>
            <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
              View program →
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
    <Section>
      <Heading as="h1" size="display">
        Find where you fit.
      </Heading>
      <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
        Every program is built for a particular stage. Start with where you actually are, not
        where you think you should be.
      </p>

      <div className="mt-10">
        <Suspense>
          <ProgramFilters />
        </Suspense>
      </div>

      <div className="mt-10">
        <ProgramsList filters={filters} />
      </div>
    </Section>
  )
}
