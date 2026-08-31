import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { formatEventTime } from '@/lib/dates'
import { resultSummary } from '@/lib/result-summary'
import { EVENTS_EMPTY } from '@/lib/empty-state-copy'
import { listUpcomingEvents, type EventFilters as Filters } from '@/server/content/events'
import { EventFilters } from './filters'

export const metadata: Metadata = {
  title: 'Events',
  description: 'New sessions, workshops and talks — the first way to participate before you’re ready to apply to anything.',
}

const TYPE_LABELS: Record<string, string> = {
  workshop: 'Workshop',
  talk: 'Talk',
  ideation: 'Ideation session',
  demo_day: 'Demo day',
  networking: 'Networking',
  hackathon: 'Hackathon',
  office_hours: 'Office hours',
}

async function EventsList({ filters }: { filters: Filters }) {
  const events = await listUpcomingEvents(filters)
  const hasFilters = Object.values(filters).some(Boolean)
  const summary = resultSummary(events.length, 'event', {
    hasFilters,
    emptyNoFilters: EVENTS_EMPTY.heading,
  })

  if (events.length === 0 && hasFilters) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState heading="No matches" body="No events match that combination yet. Try widening one filter." />
      </>
    )
  }

  if (events.length === 0) {
    return (
      <>
        <LiveRegion message={summary} />
        <EmptyState {...EVENTS_EMPTY} />
      </>
    )
  }

  return (
    <>
      <LiveRegion message={summary} />
      <p className="mb-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <LinkCard key={event.id} href={`/events/${event.slug}`} label={`View ${event.title}`}>
            <Tag tone="archive">{TYPE_LABELS[event.eventType ?? 'workshop']}</Tag>
            <Heading as="h2" size="heading" className="mt-4">
              {event.title}
            </Heading>
            <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{event.summary}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
              <span>{formatEventTime(event.startsAt)}</span>
              {event.location && <span>{event.location}</span>}
            </div>
            <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
              View event →
            </span>
          </LinkCard>
        ))}
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
  const filters: Filters = {
    eventType: params.eventType,
    format: params.format,
    stage: params.stage,
  }

  return (
    <div><div className="w-full h-[40vh] relative overflow-hidden bg-black"><img src="/images/hero_bg.jpg" alt="Hero" className="w-full h-full object-cover opacity-60" /></div>
    <Section>
      <Heading as="h1" size="display">
        What&rsquo;s on.
      </Heading>
      <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
        You don&rsquo;t need an idea to show up. Events are where curiosity turns into
        something more, one conversation at a time.
      </p>

      <div className="mt-10">
        <Suspense>
          <EventFilters />
        </Suspense>
      </div>

      <div className="mt-10">
        <EventsList filters={filters} />
      </div>
    </Section>
    </div>
  )
}
