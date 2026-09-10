import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ButtonLink, EmptyState, FilterBar, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { formatEventTime } from '@/lib/dates'
import { resultSummary } from '@/lib/result-summary'
import { EVENTS_EMPTY } from '@/lib/empty-state-copy'
import { applyFacets, deriveFacets, hasActiveFacets, type FacetSource } from '@/lib/facets'
import { EVENT_TYPE_OPTIONS, eventTypeLabel, formatLabel } from '@/lib/labels'
import { FORMAT_OPTIONS } from '@/payload/fields/taxonomy'
import { listUpcomingEvents } from '@/server/content/events'
import type { Event } from '@/payload/payload-types'

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Workshops, talks, ideation sessions and demo days at KNEST — the first way to take part, long before you are ready to apply to anything.',
}

/**
 * Type and format only.
 *
 * Stage was dropped: `relevantStages` exists so the dashboard can recommend
 * an event to the right person, which is a different job from letting a
 * visitor browse. Asking someone who came to see what is on this month to
 * first classify their own venture stage is a question the page does not
 * need an answer to.
 */
const FACETS: readonly FacetSource<Event>[] = [
  { key: 'eventType', label: 'Type', options: EVENT_TYPE_OPTIONS, valuesOf: (e) => e.eventType },
  { key: 'format', label: 'Format', options: FORMAT_OPTIONS, valuesOf: (e) => e.format },
]

const WHAT_TO_EXPECT = [
  {
    title: 'Workshops and ideation sessions',
    body: 'Hands-on, a couple of hours, and you leave with something started rather than something noted down. No prior idea required.',
  },
  {
    title: 'Talks and office hours',
    body: 'Founders, operators and investors talking about what actually happened, including the parts that went badly. Office hours are one-to-one.',
  },
  {
    title: 'Demo days and hackathons',
    body: 'Where work meets an audience. Come as a builder or come to watch — watching one is the cheapest way to understand what a good one looks like.',
  },
]

async function EventsList({ params }: { params: Record<string, string | undefined> }) {
  const all = await listUpcomingEvents()
  const events = applyFacets(all, FACETS, params)
  const facets = deriveFacets(all, FACETS, params)
  const hasFilters = hasActiveFacets(FACETS, params)
  const summary = resultSummary(events.length, 'event', {
    hasFilters,
    emptyNoFilters: EVENTS_EMPTY.heading,
  })

  return (
    <>
      <Suspense>
        <FilterBar basePath="/events" filters={facets} label="Filter events" />
      </Suspense>

      <div className={facets.length > 0 ? 'mt-10' : ''}>
        <LiveRegion message={summary} />

        {events.length === 0 && hasFilters ? (
          <EmptyState
            heading="Nothing matches that yet"
            body="No upcoming event fits that combination. Widen a filter to see the rest of what is coming up."
            action={<ButtonLink href="/events" variant="secondary">Clear filters</ButtonLink>}
          />
        ) : events.length === 0 ? (
          <EmptyState {...EVENTS_EMPTY} action={<ButtonLink href="/signup">Get told first</ButtonLink>} />
        ) : (
          <>
            <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <LinkCard key={event.id} href={`/events/${event.slug}`} label={`View ${event.title}`}>
                  <Tag tone="archive">{eventTypeLabel(event.eventType ?? 'workshop')}</Tag>
                  <Heading as="h2" size="heading" className="mt-4">
                    {event.title}
                  </Heading>
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {event.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    <span>{formatEventTime(event.startsAt)}</span>
                    {event.location && <span>{event.location}</span>}
                    {event.format && event.format !== 'in_person' && <span>{formatLabel(event.format)}</span>}
                  </div>
                  <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
                    View event →
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

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams

  return (
    <>
      <PageHeader
        kicker="Events"
        title="What’s on."
        imageSrc="/images/hero_bg.jpg"
        description="You don’t need an idea to show up. Events are where curiosity turns into something more, one conversation at a time — and they are the cheapest way to find out whether any of this is for you."
      />

      <Section padding="top">
        <EventsList params={params} />
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          What to expect
        </Heading>
        <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
          Different sessions ask different things of you. None of them ask you to arrive with a company.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {WHAT_TO_EXPECT.map((entry) => (
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
          Registering takes an account, so that we know how many chairs to put out and you can find your
          registrations again later. Most sessions are free and open to any KIIT student.
        </p>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 md:p-10">
          <Heading as="h2" size="heading">
            Never miss one
          </Heading>
          <p className="mt-3 max-w-[56ch] text-[var(--color-ink-soft)]">
            Create an account and new sessions reach you before they fill up. You can also keep track of
            everything you have registered for in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/signup">Create an account</ButtonLink>
            <ButtonLink href="/programs" variant="secondary">
              Browse programs
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  )
}
