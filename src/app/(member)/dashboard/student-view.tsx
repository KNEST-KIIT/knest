import { ButtonLink, EmptyState, Heading, LinkCard } from '@/components/ui'
import { formatDate, formatEventTime, monthAndDay } from '@/lib/dates'
import { RESOURCES_EMPTY } from '@/lib/empty-state-copy'
import { resourceDestination } from '@/lib/resource-url'
import { pathHref } from '@/server/onboarding/destination'
import { recommend } from '@/server/onboarding/recommend'
import { listRecommendedEvents } from '@/server/content/events'
import { listRecommendedResources } from '@/server/content/resources'
import { listApplicationsForUser } from '@/server/applications/actions'
import type { SessionUser } from '@/server/auth/guards'
import { ApplicationStatusBadge } from './applications/status-badge'
import { NextStepCard } from './next-step-card'

export async function StudentDashboard({
  user,
  notificationsSlot,
}: {
  user: SessionUser
  notificationsSlot?: React.ReactNode
}) {
  const result = recommend(user.platformRole, user.journeyStage)
  const [events, resources, applications] = await Promise.all([
    listRecommendedEvents(user.journeyStage),
    listRecommendedResources(user.journeyStage),
    listApplicationsForUser(user.id),
  ])

  // Derive the most actionable next step based on actual application status
  const acceptedApp = applications.find((a) => a.application.status === 'accepted')
  const draftApp = applications.find((a) => a.application.status === 'draft')
  const submittedApp = applications.find(
    (a) =>
      a.application.status === 'submitted' ||
      a.application.status === 'under_review' ||
      a.application.status === 'shortlisted' ||
      a.application.status === 'interview',
  )

  let nextStep: { eyebrow: string; heading: string; body: string; actionLabel: string; actionHref: string }

  if (acceptedApp) {
    nextStep = {
      eyebrow: 'Accepted Application',
      heading: `Welcome to ${acceptedApp.programTitle}`,
      body: 'Your application has been accepted into the program. Prepare for your upcoming cohort onboarding and milestone schedule.',
      actionLabel: 'View acceptance',
      actionHref: `/dashboard/applications/${acceptedApp.application.id}`,
    }
  } else if (draftApp && draftApp.programSlug) {
    nextStep = {
      eyebrow: 'Draft in progress',
      heading: `Continue ${draftApp.programTitle}`,
      body: 'You have an unfinished application draft. Complete your submission before the deadline to be considered by the review committee.',
      actionLabel: 'Continue application',
      actionHref: `/apply/${draftApp.programSlug}`,
    }
  } else if (submittedApp) {
    nextStep = {
      eyebrow: 'Application under review',
      heading: `${submittedApp.programTitle}`,
      body: 'Your application is actively being reviewed. We will notify you here and by email as soon as an evaluation decision is reached.',
      actionLabel: 'View application',
      actionHref: `/dashboard/applications/${submittedApp.application.id}`,
    }
  } else {
    nextStep = {
      eyebrow: 'Your next step',
      heading: result.headline || result.body,
      body: result.reason,
      actionLabel: result.cta,
      actionHref: pathHref(result.path, user.journeyStage),
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Top Row: Command Center */}
      <section>
        <p className="mb-4 text-[length:var(--text-small)] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
          Your Journey: {user.journeyStage ?? 'exploring'}
        </p>
        <NextStepCard
          eyebrow={nextStep.eyebrow}
          heading={nextStep.heading}
          body={nextStep.body}
          actionLabel={nextStep.actionLabel}
          actionHref={nextStep.actionHref}
        />
      </section>

      {/* Applications / Saved Drafts */}
      {applications.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Heading as="h2" size="heading" uppercase={false}>
              Your applications
            </Heading>
            <ButtonLink href="/dashboard/applications" variant="secondary" size="sm">
              View all
            </ButtonLink>
          </div>
          <div className="flex flex-col gap-3">
            {applications.slice(0, 4).map(({ application, programTitle, programSlug }) => (
              <div
                key={application.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-4 hover:border-[var(--color-signal)]/50 transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-[var(--color-ink)]">{programTitle}</p>
                    <ApplicationStatusBadge status={application.status} />
                  </div>
                  <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)] mt-1">
                    {application.status === 'draft'
                      ? 'Draft in progress'
                      : application.submittedAt
                        ? `Submitted ${formatDate(application.submittedAt)}`
                        : 'Not submitted'}
                  </p>
                </div>
                <ButtonLink
                  href={application.status === 'draft' && programSlug ? `/apply/${programSlug}` : `/dashboard/applications/${application.id}`}
                  size="sm"
                >
                  {application.status === 'draft' ? 'Continue application' : 'View application'}
                </ButtonLink>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notification history */}
      {notificationsSlot}

      {/* Middle Row: upcoming events. (A "Founder Playbooks" widget with hardcoded
          progress used to sit beside this; it showed new users made-up completion
          percentages for content that does not exist: KN-17.) */}
      <section className="grid gap-6 lg:grid-cols-12">
        
        {/* Calendar / Events Widget */}
        <div className="lg:col-span-12 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-sm">
          <Heading as="h2" size="heading" className="mb-6" uppercase={false}>
            Events for you
          </Heading>
          {events.length === 0 ? (
            <EmptyState headingLevel="h3" className="mt-2 flex-1 border-none shadow-none" heading="No events match your stage yet." body="Browse all events to see what is on." action={<ButtonLink href="/events" variant="secondary">Browse all events</ButtonLink>} />
          ) : (
            <div className="flex flex-col gap-4">
              {events.slice(0, 3).map((event) => {
                return (
                  <LinkCard key={event.id} href={`/events/${event.slug}`} label={`View ${event.title}`} className="!p-4 hover:border-[var(--color-signal)]/50">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-soft)] px-3 py-2 text-center min-w-[3.5rem]">
                        <span className="text-[length:var(--text-small)] font-bold uppercase text-[var(--color-signal)] leading-none">{monthAndDay(event.startsAt).month}</span>
                        <span className="text-xl font-bold leading-none mt-1 text-[var(--color-ink)]">{monthAndDay(event.startsAt).day}</span>
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
              const dest = resourceDestination(resource)
              return (
                <LinkCard key={resource.id} href={dest.href} label={dest.label} className="group hover:border-[var(--color-signal)]/50">
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
