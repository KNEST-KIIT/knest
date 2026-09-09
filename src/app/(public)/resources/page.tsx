import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { resultSummary } from '@/lib/result-summary'
import { RESOURCES_EMPTY } from '@/lib/empty-state-copy'
import { listResources, type ResourceFilters as Filters } from '@/server/content/resources'
import { ResourceFilters } from './filters'

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Guides, templates, and playbooks for each stage of building a venture at KNEST.',
}

const FORMAT_LABELS: Record<string, string> = {
  guide: 'Guide',
  template: 'Template',
  playbook: 'Playbook',
  video: 'Video',
  article: 'Article',
  worksheet: 'Worksheet',
}

async function ResourcesList({ filters }: { filters: Filters }) {
  const resources = await listResources(filters)
  const hasFilters = Object.values(filters).some(Boolean)
  const summary = resultSummary(resources.length, 'resource', {
    hasFilters,
    emptyNoFilters: RESOURCES_EMPTY.heading,
  })

  if (resources.length === 0 && hasFilters) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState heading="No matches" body="No resources match that combination yet. Try widening one filter." />
      </>
    )
  }

  if (resources.length === 0) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState {...RESOURCES_EMPTY} />
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
        {resources.map((resource) => {
          const hosted = Boolean(resource.body)
          const href = hosted ? `/resources/${resource.slug}` : resource.externalUrl || '#'
          return (
            <LinkCard key={resource.id} href={href} label={`View ${resource.title}`}>
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                <Tag tone="archive">{FORMAT_LABELS[resource.format] ?? resource.format}</Tag>
                {resource.stages && resource.stages.length > 0 && (
                  <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    {resource.stages[0]}
                  </span>
                )}
              </div>

              <Heading as="h2" size="heading" className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
                {resource.title}
              </Heading>

              <p className="mt-2 text-sm text-[var(--color-ink-soft)] font-light leading-relaxed line-clamp-2">
                {resource.summary}
              </p>

              <div className="mt-6 flex items-center justify-between border-t border-[var(--color-line)]/60 pt-4 text-xs font-mono text-[var(--color-ink-muted)]">
                {resource.readingMinutes ? (
                  <span>{resource.readingMinutes} min read</span>
                ) : (
                  <span>Interactive Resource</span>
                )}
                <span className="font-bold uppercase tracking-widest text-[var(--color-signal)]">
                  {hosted ? 'Read Guide →' : 'Access Tool →'}
                </span>
              </div>
            </LinkCard>
          )
        })}
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
  const filters: Filters = { stage: params.stage, format: params.format }

  return (
    <div>
      <PageHeader
        kicker="Tactical Repository"
        title="Start Where You Are."
        description="Filter by where you are in the journey. 'I have an idea' leads to validation frameworks; 'I am raising' leads to investor pitch templates."
        imageSrc="/images/stage_01_exploring.jpg"
        imageAlt="KNEST Resources"
        badgeText="Playbooks · Financial Models · Decks"
      />

      <Section className="py-8 md:py-10">
        <div className="border-b border-[var(--color-line)] pb-5">
          <Suspense>
            <ResourceFilters />
          </Suspense>
        </div>

        <div className="mt-6">
          <ResourcesList filters={filters} />
        </div>
      </Section>
    </div>
  )
}
