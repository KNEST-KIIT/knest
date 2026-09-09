import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ButtonLink, EmptyState, FilterBar, Heading, LinkCard, LiveRegion, Section } from '@/components/ui'
import { PageHero } from '@/components/layout/page-hero'
import { formatDate } from '@/lib/dates'
import { resultSummary } from '@/lib/result-summary'
import { PROGRAMS_EMPTY } from '@/lib/empty-state-copy'
import { applyFacets, deriveFacets, hasActiveFacets, type FacetSource } from '@/lib/facets'
import { APPLICATION_STATUS_OPTIONS, audienceLabel, stageLabel } from '@/lib/labels'
import { AUDIENCE_OPTIONS, STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import { listPrograms } from '@/server/content/programs'
import type { Program } from '@/payload/payload-types'
import { ProgramStatusBadge } from './program-status-badge'

export const metadata: Metadata = {
  title: 'Programs',
  description:
    'Every KNEST program is built for a particular stage — exploring, idea, validation, MVP or scaling. Start with where you actually are.',
}

/**
 * Three facets, not five.
 *
 * This page used to offer stage, sector, audience, format and status over a
 * catalogue that will hold a handful of programs. Sector and format were
 * dropped on the product call rather than the technical one: a KNEST program
 * is stage-shaped, not sector-shaped (an idea-stage program takes a climate
 * team and a fintech team in the same cohort), and format is in-person for
 * effectively all of them — a dropdown whose every option returns the same
 * list teaches the visitor that filtering here is pointless.
 *
 * The three that remain still have to earn the render: `deriveFacets` drops
 * any of them that fewer than two programs distinguish (src/lib/facets.ts).
 */
const FACETS: readonly FacetSource<Program>[] = [
  { key: 'stage', label: 'Your stage', options: STAGE_OPTIONS, valuesOf: (p) => p.stage },
  { key: 'audience', label: 'Who it’s for', options: AUDIENCE_OPTIONS, valuesOf: (p) => p.audience },
  {
    key: 'status',
    label: 'Applications',
    options: APPLICATION_STATUS_OPTIONS,
    valuesOf: (p) => p.applicationStatus,
  },
]

const HOW_IT_WORKS = [
  {
    step: 'Pick by stage, not ambition',
    body: 'The programs differ by how far along you are, not by how serious you are. Applying to the one above your stage is the most common way to get rejected.',
  },
  {
    step: 'Start the application',
    body: 'It saves as you go, so you can close the tab and come back. Nothing is submitted until you say so.',
  },
  {
    step: 'Answer in your own words',
    body: 'We read for how you think about the problem. A plain answer beats a polished one, every time.',
  },
  {
    step: 'Hear back with a reason',
    body: 'You get a decision and the thinking behind it. If it is a no, it will tell you what would make it a yes.',
  },
]

async function ProgramsList({ params }: { params: Record<string, string | undefined> }) {
  // The unfiltered set: facets are derived from what exists, then matching
  // happens in memory over the same accessors, so the options offered and the
  // results returned can never disagree.
  const all = await listPrograms()
  const programs = applyFacets(all, FACETS, params)
  const facets = deriveFacets(all, FACETS, params)
  const hasFilters = hasActiveFacets(FACETS, params)

  // A visible, announced result count (UX_WIREFRAMES.md §3 specified this —
  // "6 programs" next to the filter bar — and specified it be announced via
  // aria-live, since a client-side filter navigation updates the DOM without
  // a full page reload a screen reader would otherwise narrate on its own).
  const summary = resultSummary(programs.length, 'program', {
    hasFilters,
    emptyNoFilters: 'No programs yet.',
  })

  return (
    <>
      <Suspense>
        <FilterBar basePath="/programs" filters={facets} label="Filter programs" />
      </Suspense>

      <div className={facets.length > 0 ? 'mt-10' : ''}>
        {/* The visible summary is normal document content, read on a linear
            pass same as any text; the LiveRegion alongside it exists so that a
            filter change is announced even when focus hasn't moved here. */}
        <LiveRegion message={summary} />

        {programs.length === 0 && hasFilters ? (
          <EmptyState
            heading="Nothing matches that yet"
            body="No program fits that combination right now. Widen one filter, or look at what is open to everyone."
            action={<ButtonLink href="/programs" variant="secondary">Clear filters</ButtonLink>}
          />
        ) : programs.length === 0 ? (
          <EmptyState
            {...PROGRAMS_EMPTY}
            action={<ButtonLink href="/signup">Get told first</ButtonLink>}
          />
        ) : (
          <>
            <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => (
                <LinkCard key={program.id} href={`/programs/${program.slug}`} label={`View ${program.title}`}>
                  <ProgramStatusBadge status={program.applicationStatus} />
                  <Heading as="h2" size="heading" className="mt-4">
                    {program.title}
                  </Heading>
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {program.tagline}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {program.stage && program.stage.length > 0 && (
                      <span>{program.stage.map(stageLabel).join(' · ')}</span>
                    )}
                    {program.duration && <span>{program.duration}</span>}
                    {program.nextCohortStart && <span>Next: {formatDate(program.nextCohortStart)}</span>}
                  </div>
                  {program.audience && program.audience.length > 0 && (
                    <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                      For {program.audience.map((a) => audienceLabel(a).toLowerCase()).join(', ')}
                    </p>
                  )}
                  <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
                    View program →
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

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams

  return (
    <>
      <PageHero
        eyebrow="Programs"
        title="Find where you fit."
        lede="Every program is built for a particular stage. Start with where you actually are, not where you think you should be — the fit matters more than the ambition."
      />

      <Section padding="top">
        <ProgramsList params={params} />
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          How applying works
        </Heading>
        <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
          No committee theatre, no pitch deck template to download. Four steps, and you can stop at any
          of them.
        </p>
        <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((entry, i) => (
            <li
              key={entry.step}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6"
            >
              <span
                aria-hidden
                className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-semibold text-[var(--color-signal)]"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <Heading as="h3" size="heading" className="mt-3">
                {entry.step}
              </Heading>
              <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                {entry.body}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 md:p-10">
          <Heading as="h2" size="heading">
            Not sure which one?
          </Heading>
          <p className="mt-3 max-w-[56ch] text-[var(--color-ink-soft)]">
            Most people are not, and applying is not the only way in. Come to an event and see what this
            is like from the inside, or find a mentor and describe what you are stuck on. Both are open
            to you before you have anything to show.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/events" variant="secondary">
              See what&rsquo;s on
            </ButtonLink>
            <ButtonLink href="/mentors" variant="secondary">
              Find a mentor
            </ButtonLink>
            <ButtonLink href="/faq" variant="secondary">
              Read the questions
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  )
}
