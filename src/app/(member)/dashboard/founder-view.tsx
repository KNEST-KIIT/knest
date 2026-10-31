import { ButtonLink, EmptyState, Heading, LinkCard } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { RESOURCES_EMPTY } from '@/lib/empty-state-copy'
import { resourceDestination } from '@/lib/resource-url'
import { listApplicationsForUser } from '@/server/applications/actions'
import { getProgramById } from '@/server/content/programs'
import { getStartupForUser } from '@/server/content/startups'
import { isLabBookingEnabled } from '@/server/features'
import { listRecommendedResources } from '@/server/content/resources'
import type { SessionUser } from '@/server/auth/guards'
import { ApplicationStatusBadge } from './applications/status-badge'
import { NextStepCard } from './next-step-card'

export async function FounderDashboard({
  user,
  notificationsSlot,
}: {
  user: SessionUser
  notificationsSlot?: React.ReactNode
}) {
  const [applications, startup, resources] = await Promise.all([
    listApplicationsForUser(user.id),
    getStartupForUser(user.id),
    listRecommendedResources(user.journeyStage),
  ])
  const accepted = applications.find((row) => row.application.status === 'accepted')
  const program = accepted ? await getProgramById(accepted.application.programId) : null

  const nextMilestone = program?.timeline?.[0]

  return (
    <div className="flex flex-col gap-8">
      {/* Founder Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--color-line)] bg-white p-4 shadow-sm sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-signal)]/10 text-[var(--color-signal)] font-bold text-lg">
            🚀
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--color-ink)]">Founder Venture Hub</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-emerald-700 border border-emerald-200">
                Active Cohort
              </span>
            </div>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Campus 15B Incubation Wing · KIIT Technology Business Incubator
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isLabBookingEnabled() && (
            <ButtonLink href="/dashboard/lab-booking" variant="secondary" size="sm" className="text-xs">
              ⚡ Book Maker Lab
            </ButtonLink>
          )}
          <ButtonLink href="/programs" variant="secondary" size="sm" className="text-xs">
            🧭 Explore Grants & Cohorts
          </ButtonLink>
          <ButtonLink href="/dashboard/account" variant="secondary" size="sm" className="text-xs">
            ⚙️ Founder Profile
          </ButtonLink>
        </div>
      </div>

      {/* Top Row: Next Milestone & Startup Identity */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className={startup ? 'lg:col-span-6' : 'lg:col-span-7'}>
          <NextStepCard
            eyebrow="Next milestone"
            heading={nextMilestone?.label ?? program?.title ?? 'Start Your Application'}
            body={
              nextMilestone?.description ||
              (program
                ? `You're in ${program.title}. Keep building and hit your key validation metrics!`
                : 'Accelerate your venture by applying to our active incubation and grant cohorts.')
            }
            actionLabel={program ? 'View Program Details' : 'Browse Cohorts & Grants'}
            actionHref={program ? `/programs/${program.slug}` : '/programs'}
          />
        </div>

        {startup ? (
          <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-signal)]">
                  Registered Venture
                </span>
                {startup.stage && (
                  <span className="rounded-md bg-stone-100 px-2.5 py-1 font-mono text-xs uppercase tracking-wider text-stone-700 font-semibold border border-stone-200">
                    {startup.stage}
                  </span>
                )}
              </div>
              <Heading as="h2" size="heading" uppercase={false} className="mt-1">
                {startup.name}
              </Heading>
              <p className="mt-2 text-sm text-[var(--color-ink-soft)] line-clamp-2">
                {startup.tagline}
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[var(--color-line)]/60 pt-4">
              <span className="text-xs text-[var(--color-ink-muted)]">
                KNEST Showcase Profile
              </span>
              <ButtonLink href={`/startups/${startup.slug}`} size="sm" variant="secondary">
                View Startup Page →
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-dashed border-[var(--color-line)] bg-stone-50/60 p-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Campus 15B Venture Registry
              </span>
              <h3 className="mt-2 text-lg font-bold text-[var(--color-ink)]">
                Register Your Startup Entity
              </h3>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)] leading-relaxed">
                Connect your pitch deck, co-founders, and funding status to unlock direct investor introductions and institutional grants.
              </p>
            </div>
            <div className="mt-4">
              <ButtonLink href="/contact?topic=incubation" variant="secondary" size="sm" className="w-full justify-center">
                Submit Venture Details
              </ButtonLink>
            </div>
          </div>
        )}
      </section>

      {/* Middle Row: Applications Pipeline */}
      <section className="flex flex-col rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div>
            <Heading as="h2" size="heading" uppercase={false}>
              Application Pipeline
            </Heading>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              Active tracks, grant proposals, and cohort evaluations
            </p>
          </div>
          <ButtonLink href="/programs" variant="secondary" size="sm" className="text-xs">
            + New Application
          </ButtonLink>
        </div>

        {applications.length === 0 ? (
          <EmptyState
            headingLevel="h3"
            className="mt-2 border-none shadow-none"
            heading="No Active Applications"
            body="You have not submitted any cohort or grant applications yet. Check open programs to get started."
            action={
              <ButtonLink href="/programs" variant="secondary">
                Browse Open Programs
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {applications.slice(0, 4).map(({ application, programTitle, programSlug }) => (
              <div
                key={application.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-4 hover:border-[var(--color-signal)]/60 transition-all hover:shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-sm text-[var(--color-ink)] line-clamp-1">
                      {programTitle}
                    </p>
                    <ApplicationStatusBadge status={application.status} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    {application.submittedAt
                      ? `Submitted on ${formatDate(application.submittedAt)}`
                      : 'Draft · Not yet submitted'}
                  </p>
                </div>
                <div className="pt-2 border-t border-[var(--color-line)]/40 flex justify-end">
                  <ButtonLink
                    href={
                      application.status === 'draft' && programSlug
                        ? `/apply/${programSlug}`
                        : `/dashboard/applications/${application.id}`
                    }
                    variant="secondary"
                    size="sm"
                    className="text-xs font-medium"
                  >
                    {application.status === 'draft' ? 'Resume Application →' : 'View Submission →'}
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notification history */}
      {notificationsSlot}

      {/* Bottom Row: Stage Resources & Playbooks */}
      <section className="rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div>
            <Heading as="h2" size="heading" uppercase={false}>
              Founder Playbooks & Resources
            </Heading>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              Curated frameworks for validation, equity splits, and venture building
            </p>
          </div>
          <ButtonLink href="/resources" variant="secondary" size="sm" className="text-xs">
            Browse All Resources
          </ButtonLink>
        </div>

        {resources.length === 0 ? (
          <EmptyState headingLevel="h3" className="mt-2 border-none shadow-none" {...RESOURCES_EMPTY} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => {
              const dest = resourceDestination(resource)
              return (
                <LinkCard
                  key={resource.id}
                  href={dest.href}
                  label={dest.label}
                  className="group hover:border-[var(--color-signal)]/50 transition-all"
                >
                  <p className="font-medium text-[var(--color-ink)] group-hover:text-[var(--color-signal)] transition-colors">
                    {resource.title}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-ink-soft)] line-clamp-2">
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
