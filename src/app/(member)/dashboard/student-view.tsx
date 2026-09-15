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

  // Hardcoded Learning Playbooks based on the "student to founder" pipeline requirement
  const learningPlaybooks = [
    { title: 'Idea Validation 101', progress: 100, status: 'completed' },
    { title: 'Customer Discovery', progress: 45, status: 'in-progress' },
    { title: 'Pitch Deck Fundamentals', progress: 0, status: 'locked' }
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Top Row: Command Center */}
      <section>
        <p className="mb-4 text-[length:var(--text-small)] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
          Your Journey: {user.journeyStage ?? 'exploring'}
        </p>
        <NextStepCard
          eyebrow="Your next step"
          heading={result.headline || result.body}
          body={result.reason}
          actionLabel={result.cta}
          actionHref={pathHref(result.path, user.journeyStage)}
        />
      </section>

      {/* Middle Row: Bento Grid (Learning Hub & Events) */}
      <section className="grid gap-6 lg:grid-cols-12">
        
        {/* Learning Hub Widget (Spans 7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <Heading as="h2" size="heading" uppercase={false}>
              Founder Playbooks
            </Heading>
            <span className="rounded-full bg-[var(--color-signal-wash)] px-3 py-1 text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
              Phase 1
            </span>
          </div>
          
          <div className="flex flex-col gap-4">
            {learningPlaybooks.map((playbook, idx) => (
              <div key={idx} className={`relative overflow-hidden rounded-lg border border-[var(--color-line)] p-4 transition-colors ${playbook.status === 'in-progress' ? 'bg-[var(--color-paper-soft)] border-[var(--color-signal)]/30' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`font-medium ${playbook.status === 'locked' ? 'text-[var(--color-ink-muted)]' : 'text-[var(--color-ink)]'}`}>
                    {playbook.title}
                  </p>
                  <span className="text-[length:var(--text-small)] text-[var(--color-ink-muted)] font-medium">
                    {playbook.progress}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${playbook.status === 'completed' ? 'bg-[var(--color-signal)]' : 'bg-[var(--color-signal)]'}`}
                    style={{ width: `${playbook.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar / Events Widget (Spans 5 cols) */}
        <div className="lg:col-span-5 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-sm">
          <Heading as="h2" size="heading" className="mb-6" uppercase={false}>
            Upcoming Events
          </Heading>
          {events.length === 0 ? (
            <EmptyState headingLevel="h3" className="mt-2 flex-1 border-none shadow-none" heading="Nothing on your calendar." body="New sessions are added regularly." />
          ) : (
            <div className="flex flex-col gap-4">
              {events.slice(0, 3).map((event) => {
                const dateObj = new Date(event.startsAt)
                return (
                  <LinkCard key={event.id} href={`/events/${event.slug}`} label={`View ${event.title}`} className="!p-4 hover:border-[var(--color-signal)]/50">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-soft)] px-3 py-2 text-center min-w-[3.5rem]">
                        <span className="text-[length:var(--text-small)] font-bold uppercase text-[var(--color-signal)] leading-none">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-xl font-bold leading-none mt-1 text-[var(--color-ink)]">{dateObj.getDate()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--color-ink)] line-clamp-1">{event.title}</p>
                        <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                          {formatEventTime(event.startsAt)}
                        </p>
                      </div>
                    </div>
                  </LinkCard>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Bottom Row: Resources feed */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <Heading as="h2" size="heading" className="mb-6" uppercase={false}>
          Worth reading
        </Heading>
        {resources.length === 0 ? (
          <EmptyState headingLevel="h3" className="mt-2 border-none shadow-none" {...RESOURCES_EMPTY} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => {
              const hosted = Boolean(resource.body)
              const href = hosted ? `/resources/${resource.slug}` : resource.externalUrl || '#'
              return (
                <LinkCard key={resource.id} href={href} label={`${hosted ? 'Read' : 'Visit'} ${resource.title}`} className="group hover:border-[var(--color-signal)]/50">
                  <p className="font-medium text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">{resource.title}</p>
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)] line-clamp-2">
                    {resource.summary}
                  </p>
                </LinkCard>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
