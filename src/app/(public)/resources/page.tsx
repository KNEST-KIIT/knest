import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ButtonLink, EmptyState, FilterBar, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { resultSummary } from '@/lib/result-summary'
import { RESOURCES_EMPTY } from '@/lib/empty-state-copy'
import { applyFacets, deriveFacets, hasActiveFacets, type FacetSource } from '@/lib/facets'
import { RESOURCE_FORMAT_OPTIONS, resourceFormatLabel, stageLabel } from '@/lib/labels'
import { STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import { listResources } from '@/server/content/resources'
import type { Resource } from '@/payload/payload-types'

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'Guides, templates and playbooks for each stage of building — sorted by where you actually are, not by what you would have to know to search for them.',
}

/** Stage is the one that matters here, format second. Both are hidden until the library is big enough that a visitor cannot simply read the whole page (src/lib/facets.ts). */
const FACETS: readonly FacetSource<Resource>[] = [
  { key: 'stage', label: 'Your stage', options: STAGE_OPTIONS, valuesOf: (r) => r.stages },
  { key: 'format', label: 'Format', options: RESOURCE_FORMAT_OPTIONS, valuesOf: (r) => r.format },
]

const WHAT_IS_HERE = [
  {
    title: 'Guides and playbooks',
    body: 'How to run a customer interview, how to size a market honestly, what a first term sheet is really saying. Written for someone doing it for the first time.',
  },
  {
    title: 'Templates and worksheets',
    body: 'Fill-in documents you can take straight into a meeting — validation plans, financial models, one-page pitches.',
  },
  {
    title: 'Talks and articles',
    body: 'Recordings and write-ups from sessions, so missing one is inconvenient rather than final.',
  },
]

async function ResourcesList({ params }: { params: Record<string, string | undefined> }) {
  const all = await listResources()
  const resources = applyFacets(all, FACETS, params)
  const facets = deriveFacets(all, FACETS, params)
  const hasFilters = hasActiveFacets(FACETS, params)
  const summary = resultSummary(resources.length, 'resource', {
    hasFilters,
    emptyNoFilters: RESOURCES_EMPTY.heading,
  })

  return (
    <>
      <Suspense>
        <FilterBar basePath="/resources" filters={facets} label="Filter resources" />
      </Suspense>

      <div className={facets.length > 0 ? 'mt-10' : ''}>
        <LiveRegion message={summary} />

        {resources.length === 0 && hasFilters ? (
          <EmptyState
            heading="Nothing matches that yet"
            body="No resource fits that combination. Widen a filter, or browse everything and see what is close."
            action={<ButtonLink href="/resources" variant="secondary">Clear filters</ButtonLink>}
          />
        ) : resources.length === 0 ? (
          <EmptyState
            {...RESOURCES_EMPTY}
            action={<ButtonLink href="/events" variant="secondary">Come to a session instead</ButtonLink>}
          />
        ) : (
          <>
            <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {resources.map((resource) => {
                const hosted = Boolean(resource.body)
                const href = hosted ? `/resources/${resource.slug}` : resource.externalUrl || '#'
                return (
                  <LinkCard key={resource.id} href={href} label={`View ${resource.title}`}>
                    <Tag tone="archive">{resourceFormatLabel(resource.format)}</Tag>
                    <Heading as="h2" size="heading" className="mt-4">
                      {resource.title}
                    </Heading>
                    <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                      {resource.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                      {resource.stages && resource.stages.length > 0 && (
                        <span>{resource.stages.map(stageLabel).join(' · ')}</span>
                      )}
                      {resource.readingMinutes && <span>{resource.readingMinutes} min read</span>}
                    </div>
                    <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
                      {hosted ? 'Read →' : 'Visit ↗'}
                    </span>
                  </LinkCard>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams

  return (
    <>
      <PageHeader
        kicker="Resources"
        title="Start where you are."
        imageSrc="/images/stage_exploring.jpg"
        description="“I have an idea” needs validation material. “I am raising” needs fundraising material. Everything here is filed by stage, so you do not have to already know the vocabulary to find the right thing."
      />

      <Section padding="top">
        <ResourcesList params={params} />
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          What&rsquo;s here
        </Heading>
        <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
          Practical material, written or chosen by people who have done the thing they are describing.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {WHAT_IS_HERE.map((entry) => (
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
        <p className="mt-8 max-w-[56ch] text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          Some resources are hosted here and some point somewhere better. Cards say which before you
          click: <em>Read</em> stays on KNEST, <em>Visit</em> opens elsewhere.
        </p>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 md:p-10">
          <Heading as="h2" size="heading">
            Reading only gets you so far
          </Heading>
          <p className="mt-3 max-w-[56ch] text-[var(--color-ink-soft)]">
            Every guide here describes something that is easier with someone next to you. When you hit
            that point, find a mentor who has done it, or bring the question to a session.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/mentors">Find a mentor</ButtonLink>
            <ButtonLink href="/events" variant="secondary">
              See what&rsquo;s on
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  )
}
