import { EmptyState, Heading, LinkCard } from '@/components/ui'
import { formatEventTime } from '@/lib/dates'
import { RESOURCES_EMPTY } from '@/lib/empty-state-copy'
import { recommend } from '@/server/onboarding/recommend'
import { listRecommendedEvents } from '@/server/content/events'
import { listRecommendedResources } from '@/server/content/resources'
import type { SessionUser } from '@/server/auth/guards'
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
  const [events, resources] = await Promise.all([
    listRecommendedEvents(user.journeyStage),
    listRecommendedResources(user.journeyStage),
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
