import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EmptyState, Heading, LinkCard, LiveRegion, Section, Tag } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { formatEventTime } from '@/lib/dates'
import { resultSummary } from '@/lib/result-summary'
import { EVENTS_EMPTY } from '@/lib/empty-state-copy'
import { listUpcomingEvents, type EventFilters as Filters } from '@/server/content/events'
import { EventFilters } from './filters'

export const metadata: Metadata = {
  title: 'Events',
  description: 'Sessions, workshops, and demo days at KNEST — turn curiosity into momentum.',
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
      <p className="mb-6 font-mono text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
        Showing {summary}
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <LinkCard key={event.id} href={`/events/${event.slug}`} label={`View ${event.title}`}>
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
              <Tag tone="archive">{TYPE_LABELS[event.eventType ?? 'workshop']}</Tag>
              {event.format && (
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {event.format}
                </span>
              )}
            </div>

            <Heading as="h2" size="heading" className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
              {event.title}
            </Heading>
            
            <p className="mt-2 text-sm text-[var(--color-ink-soft)] font-light leading-relaxed line-clamp-2">
              {event.summary}
            </p>

            <div className="mt-6 flex flex-col gap-1 border-t border-[var(--color-line)]/60 pt-4 text-xs font-mono text-[var(--color-ink-muted)]">
              <span className="text-[var(--color-ink)] font-semibold">{formatEventTime(event.startsAt)}</span>
              {event.location && <span>{event.location}</span>}
            </div>

            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--color-signal)]">
              Event Details &amp; RSVP →
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
    <div>
      <PageHeader
        kicker="Ecosystem Calendar"
        title="What’s On."
        description="You don’t need an incorporated company to participate. Workshops, clinics, ideation jams, and demo days are where curiosity turns into momentum."
        imageSrc="/images/stage_02_idea.jpg"
        imageAlt="KNEST Events"
        badgeText="Open Mixers · Hackathons · Founder Clinics"
      />

      <Section className="py-8 md:py-10">
        <div className="border-b border-[var(--color-line)] pb-5">
          <Suspense>
            <EventFilters />
          </Suspense>
        </div>

        <div className="mt-6">
          <EventsList filters={filters} />
        </div>
      </Section>
    </div>
  )
}
