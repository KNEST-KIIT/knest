import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState, LinkCard, Section, SectionHeading } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { listPrograms, type ProgramFilters as Filters } from '@/server/content/programs'
import { ProgramFilters } from './filters'
import { ProgramStatusBadge } from './program-status-badge'

export const metadata: Metadata = {
  title: 'Programs',
  description: 'Every program is built for a particular stage. Start with where you actually are.',
}

async function ProgramsList({ filters }: { filters: Filters }) {
  const programs = await listPrograms(filters)
  const hasFilters = Object.values(filters).some(Boolean)

  if (programs.length === 0 && hasFilters) {
    return (
      <EmptyState
        heading="No matches"
        body="No programs match that combination yet. Try widening one filter."
      />
    )
  }

  if (programs.length === 0) {
    return (
      <EmptyState
        heading="Programs are being finalised."
        body="Applications open soon. Create an account and we'll tell you first."
      />
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {programs.map((program) => (
        <LinkCard key={program.id} href={`/programs/${program.slug}`} label={`View ${program.title}`}>
          <ProgramStatusBadge status={program.applicationStatus} />
          <h3 className="mt-4 font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-bold uppercase leading-tight">
            {program.title}
          </h3>
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
      <SectionHeading as="h1" className="text-[length:var(--text-display)]">
        Find where you fit.
      </SectionHeading>
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
