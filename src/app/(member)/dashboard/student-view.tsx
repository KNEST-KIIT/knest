import Link from 'next/link'
import { ButtonLink, Card, EmptyState, Heading, LinkCard } from '@/components/ui'
import { formatDate, formatEventTime } from '@/lib/dates'
import { RESOURCES_EMPTY } from '@/lib/empty-state-copy'
import { recommend } from '@/server/onboarding/recommend'
import { listApplicationsForUser } from '@/server/applications/actions'
import { listRecommendedEvents } from '@/server/content/events'
import { listRecommendedResources } from '@/server/content/resources'
import type { SessionUser } from '@/server/auth/guards'
import { ApplicationStatusBadge } from './applications/status-badge'
import { NextStepCard } from './next-step-card'

/** Where each recommended path actually sends someone — recommend() itself only carries the label. */
function pathHref(path: string, stage: string | null): string {
  const stageParam = stage ? `?stage=${stage}` : ''
  switch (path) {
    case 'EXPLORE':
      return '/events'
    case 'CONNECT':
      return '/about#contact'
    default:
      return `/programs${stageParam}`
  }
}

export async function StudentDashboard({ user }: { user: SessionUser }) {
  const result = recommend(user.platformRole, user.journeyStage)
  const [events, resources, applications] = await Promise.all([
    listRecommendedEvents(user.journeyStage),
    listRecommendedResources(user.journeyStage),
    listApplicationsForUser(user.id),
  ])

  return (
    <>
      <section>
        <p className="text-[length:var(--text-small)] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
          Your journey: {user.journeyStage ?? 'exploring'}
        </p>
        <div className="mt-4">
          <NextStepCard
            eyebrow="Your next step"
            heading={result.headline}
            body={result.body}
            reason={result.reason}
            actionLabel={result.cta}
            actionHref={pathHref(result.path, user.journeyStage)}
          />
        </div>
      </section>

      {/*
        An application in progress is the most time-sensitive thing this
        person has, and the dashboard did not mention it at all: a student
        could leave a draft half-finished against a deadline and see no trace
        of it anywhere except a page they had no reason to visit. It sits
        above "what's coming up" because a draft expires and an event does
        not. Nothing renders here when there is nothing to chase.
      */}
      {applications.length > 0 && (
        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <Heading as="h2" size="title">
              Your applications
            </Heading>
            <Link
              href="/dashboard/applications"
              className="text-[length:var(--text-small)] font-medium text-[var(--color-signal)] hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            {applications.slice(0, 3).map(({ application, programTitle, programSlug }) => (
              <Card
                key={application.id}
                className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Heading as="h3" size="heading">
                    {programTitle}
                  </Heading>
                  {/* Only the submitted date. The status badge beside it already
                      says "Not submitted yet — pick up where you left off." for a
                      draft, and printing that twice in one row reads as a glitch. */}
                  {application.submittedAt && (
                    <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                      Submitted {formatDate(application.submittedAt)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <ApplicationStatusBadge status={application.status} />
                  {application.status === 'draft' && programSlug && (
                    <ButtonLink href={`/apply/${programSlug}`} size="sm">
                      Continue
                    </ButtonLink>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <Heading as="h2" size="title">
          What&rsquo;s coming up
        </Heading>
        {events.length === 0 ? (
          <EmptyState headingLevel="h3"
            className="mt-6"
            heading="Nothing on your calendar yet."
            body="New sessions, workshops and talks are added regularly."
          />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <LinkCard key={event.id} href={`/events/${event.slug}`} label={`View ${event.title}`}>
                <p className="font-medium">{event.title}</p>
                <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {formatEventTime(event.startsAt)}
                </p>
              </LinkCard>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <Heading as="h2" size="title">
          Worth reading
        </Heading>
        {resources.length === 0 ? (
          <EmptyState headingLevel="h3" className="mt-6" {...RESOURCES_EMPTY} />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => {
              const hosted = Boolean(resource.body)
              const href = hosted ? `/resources/${resource.slug}` : resource.externalUrl || '#'
              return (
                <LinkCard key={resource.id} href={href} label={`${hosted ? 'Read' : 'Visit'} ${resource.title}`}>
                  <p className="font-medium">{resource.title}</p>
                  <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {resource.summary}
                  </p>
                </LinkCard>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
