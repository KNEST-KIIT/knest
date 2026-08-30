import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { resultSummary } from '@/lib/result-summary'
import { RESOURCES_EMPTY } from '@/lib/empty-state-copy'
import { listResources, type ResourceFilters as Filters } from '@/server/content/resources'
import { ResourceFilters } from './filters'

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Guides, templates and playbooks for each stage — start with where you actually are.',
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
      <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => {
          const hosted = Boolean(resource.body)
          const href = hosted ? `/resources/${resource.slug}` : resource.externalUrl || '#'
          return (
            <LinkCard key={resource.id} href={href} label={`View ${resource.title}`}>
              <Tag tone="archive">{FORMAT_LABELS[resource.format]}</Tag>
              <Heading as="h3" size="heading" className="mt-4">
                {resource.title}
              </Heading>
              <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{resource.summary}</p>
              {resource.readingMinutes && (
                <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {resource.readingMinutes} min read
                </p>
              )}
              <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
                {hosted ? 'Read →' : 'Visit →'}
              </span>
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
    <Section>
      <Heading as="h1" size="display">
        Start where you are.
      </Heading>
      <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
        &ldquo;I have an idea&rdquo; leads to validation material. &ldquo;I am raising&rdquo; leads to
        fundraising material. Filter by stage, not by guessing what to search for.
      </p>

      <div className="mt-10">
        <Suspense>
          <ResourceFilters />
        </Suspense>
      </div>

      <div className="mt-10">
        <ResourcesList filters={filters} />
      </div>
    </Section>
  )
}
