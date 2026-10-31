import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
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

const ROADMAP_STAGES = [
  { id: 'exploring', label: 'Exploring', subtitle: 'Problem Hunt' },
  { id: 'idea', label: 'Idea Validation', subtitle: 'Customer Discovery' },
  { id: 'mvp', label: 'MVP Prototype', subtitle: 'Code & Hardware' },
  { id: 'early_revenue', label: 'Early Traction', subtitle: 'Pilot & Users' },
  { id: 'scaling', label: 'Incubated Venture', subtitle: 'KNEST Cohort' },
]

export async function StudentDashboard({
  user,
  notificationsSlot,
}: {
  user: SessionUser
  notificationsSlot?: React.ReactNode
}) {
  const [events, resources, applications, profileRow] = await Promise.all([
    listRecommendedEvents(user.journeyStage),
    listRecommendedResources(user.journeyStage),
    listApplicationsForUser(user.id),
    db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { school: true, skills: true, graduationYear: true },
    }),
  ])

  const result = recommend(user.platformRole, user.journeyStage)

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
      body: 'Your application has been accepted into the cohort. Check your onboarding schedule and lab resources.',
      actionLabel: 'View acceptance',
      actionHref: `/dashboard/applications/${acceptedApp.application.id}`,
    }
  } else if (draftApp && draftApp.programSlug) {
    nextStep = {
      eyebrow: 'Draft in progress',
      heading: `Continue ${draftApp.programTitle}`,
      body: 'You have an unfinished application draft. Complete your submission to be evaluated by the incubation committee.',
      actionLabel: 'Continue application',
      actionHref: `/apply/${draftApp.programSlug}`,
    }
  } else if (submittedApp) {
    nextStep = {
      eyebrow: 'Application under review',
      heading: `${submittedApp.programTitle}`,
      body: 'Your application is actively being evaluated by KNEST mentors and committee members. Track its progress here.',
      actionLabel: 'View status',
      actionHref: `/dashboard/applications/${submittedApp.application.id}`,
    }
  } else {
    nextStep = {
      eyebrow: 'Recommended step',
      heading: result.headline || result.body,
      body: result.reason,
      actionLabel: result.cta,
      actionHref: pathHref(result.path, user.journeyStage),
    }
  }

  // Determine current stage index for roadmap
  const currentStageIndex = ROADMAP_STAGES.findIndex(
    (s) => s.id === (user.journeyStage || 'exploring'),
  )
  const activeIndex = currentStageIndex >= 0 ? currentStageIndex : 0

  return (
    <div className="flex flex-col gap-10">
      {/* Student Command Bar */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-gradient-to-r from-white via-[var(--color-paper-soft)]/50 to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Student Builder
              </span>
              {profileRow?.school && (
                <span className="text-xs font-medium text-[var(--color-ink-muted)]">
                  · {profileRow.school}
                </span>
              )}
            </div>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">
              Your Venture Command Center
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              Track incubation applications, reserve campus maker labs, and connect with mentors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/dashboard/lab-booking" size="sm" variant="secondary">
              🏢 Book Maker Lab
            </ButtonLink>
            <ButtonLink href="/programs" size="sm" variant="secondary">
              🚀 Explore Cohorts
            </ButtonLink>
            <ButtonLink href="/dashboard/account" size="sm" variant="secondary">
              👤 Edit Profile
            </ButtonLink>
          </div>
        </div>

        {/* 5-Stage Venture Progression Ribbon */}
        <div className="mt-6 border-t border-[var(--color-line)]/70 pt-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-signal)]">
              Zero to Launch Runway
            </span>
            <span className="text-xs font-mono text-[var(--color-ink-muted)]">
              Stage {activeIndex + 1} of 5
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ROADMAP_STAGES.map((stage, idx) => {
              const isPast = idx < activeIndex
              const isCurrent = idx === activeIndex
              return (
                <div
                  key={stage.id}
                  className={`relative rounded-xl border p-3 transition-all ${
                    isCurrent
                      ? 'border-[var(--color-signal)] bg-white shadow-xs'
                      : isPast
                        ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                        : 'border-[var(--color-line)]/60 bg-[var(--color-paper-soft)]/40 text-[var(--color-ink-muted)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold">0{idx + 1}</span>
                    {isPast ? (
                      <span className="text-xs text-emerald-600 font-bold">✓</span>
                    ) : isCurrent ? (
                      <span className="size-2 rounded-full bg-[var(--color-signal)] animate-ping" />
                    ) : null}
                  </div>
                  <p
                    className={`mt-1 truncate text-xs font-bold ${
                      isCurrent ? 'text-[var(--color-ink)]' : ''
                    }`}
                  >
                    {stage.label}
                  </p>
                  <p className="truncate text-[10px] text-[var(--color-ink-muted)]">
                    {stage.subtitle}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Hero Next Step Card */}
      <section>
        <NextStepCard
          eyebrow={nextStep.eyebrow}
          heading={nextStep.heading}
          body={nextStep.body}
          actionLabel={nextStep.actionLabel}
          actionHref={nextStep.actionHref}
        />
      </section>

      {/* Applications / Active Drafts */}
      {applications.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Heading as="h2" size="heading" uppercase={false}>
                Your Cohort &amp; Incubation Applications
              </Heading>
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                Submitted applications are reviewed by the KNEST faculty and EIR committee.
              </p>
            </div>
            <ButtonLink href="/dashboard/applications" variant="secondary" size="sm">
              View all ({applications.length})
            </ButtonLink>
          </div>
          <div className="flex flex-col gap-3">
            {applications.slice(0, 4).map(({ application, programTitle, programSlug }) => (
              <div
                key={application.id}
                className="group flex flex-col gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft)]/50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-signal)]/50 hover:bg-white hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-[var(--color-ink)]">{programTitle}</p>
                    <ApplicationStatusBadge status={application.status} />
                  </div>
                  <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                    {application.status === 'draft'
                      ? 'Draft in progress · Autosaved'
                      : application.submittedAt
                        ? `Submitted ${formatDate(application.submittedAt)}`
                        : 'Not submitted'}
                  </p>
                </div>
                <ButtonLink
                  href={
                    application.status === 'draft' && programSlug
                      ? `/apply/${programSlug}`
                      : `/dashboard/applications/${application.id}`
                  }
                  size="sm"
                  variant={application.status === 'accepted' ? 'primary' : 'secondary'}
                >
                  {application.status === 'draft' ? 'Continue application →' : 'View evaluation →'}
                </ButtonLink>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Campus Maker Labs & Prototyping Facilities */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-gradient-to-br from-white to-[var(--color-paper-soft)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--color-signal)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-signal)]">
                Campus 15B Infrastructure
              </span>
              <span className="text-xs text-[var(--color-ink-muted)]">· Open for Student Booking</span>
            </div>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
              Maker Spaces, IoT Labs &amp; Founder Studios
            </h3>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)] max-w-xl">
              Reserve 3D printers, laser cutters, electronics testing benches, and sound-isolated cabins directly with your student ID.
            </p>
          </div>
          <ButtonLink href="/dashboard/lab-booking" size="sm">
            Book a Facility →
          </ButtonLink>
        </div>
      </section>

      {/* Notifications Slot */}
      {notificationsSlot}

      {/* Events & Masterclasses */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading as="h2" size="heading" uppercase={false}>
              Founder Sessions &amp; Masterclasses
            </Heading>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              Workshops, pitch clinics, and founder firesides matching your journey stage.
            </p>
          </div>
          <ButtonLink href="/events" variant="secondary" size="sm">
            Browse all events
          </ButtonLink>
        </div>

        {events.length === 0 ? (
          <EmptyState
            headingLevel="h3"
            className="border-none shadow-none"
            heading="No events match your stage yet."
            body="Browse all campus events to see what is coming up next."
            action={
              <ButtonLink href="/events" variant="secondary">
                Browse all events
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 3).map((event) => {
              const { month, day } = monthAndDay(event.startsAt)
              return (
                <LinkCard
                  key={event.id}
                  href={`/events/${event.slug}`}
                  label={`View ${event.title}`}
                  className="group !p-4 hover:border-[var(--color-signal)]/60 hover:shadow-xs transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex min-w-[3.25rem] flex-col items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft)] px-2.5 py-2 text-center">
                      <span className="text-[10px] font-bold uppercase text-[var(--color-signal)] leading-none">
                        {month}
                      </span>
                      <span className="text-lg font-bold leading-none mt-1 text-[var(--color-ink)] font-[family-name:var(--font-display)]">
                        {day}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-[var(--color-ink)] line-clamp-1 group-hover:text-[var(--color-signal)] transition-colors">
                        {event.title}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                        {formatEventTime(event.startsAt)}
                      </p>
                    </div>
                  </div>
                </LinkCard>
              )
            })}
          </div>
        )}
      </section>

      {/* Founder Playbooks & Knowledge Base */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading as="h2" size="heading" uppercase={false}>
              Venture Playbooks &amp; Guides
            </Heading>
            <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
              Curated frameworks for user interviews, pitch decks, and legal foundations.
            </p>
          </div>
          <ButtonLink href="/resources" variant="secondary" size="sm">
            All resources
          </ButtonLink>
        </div>

        {resources.length === 0 ? (
          <EmptyState headingLevel="h3" className="border-none shadow-none" {...RESOURCES_EMPTY} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.slice(0, 3).map((resource) => {
              const dest = resourceDestination(resource)
              return (
                <LinkCard
                  key={resource.id}
                  href={dest.href}
                  label={dest.label}
                  className="group !p-5 hover:border-[var(--color-signal)]/60 hover:shadow-xs transition-all"
                >
                  <p className="font-semibold text-sm text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">
                    {resource.title}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-ink-soft)] line-clamp-2 leading-relaxed">
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
