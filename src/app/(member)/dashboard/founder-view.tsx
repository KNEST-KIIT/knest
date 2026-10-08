import { EmptyState, Heading, LinkCard } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { RESOURCES_EMPTY } from '@/lib/empty-state-copy'
import { listApplicationsForUser } from '@/server/applications/actions'
import { getProgramById } from '@/server/content/programs'
import { isLabBookingEnabled } from '@/server/features'
import { listRecommendedResources } from '@/server/content/resources'
import type { SessionUser } from '@/server/auth/guards'
import { ApplicationStatusBadge } from './applications/status-badge'
import { NextStepCard } from './next-step-card'

export async function FounderDashboard({ user }: { user: SessionUser }) {
  const applications = await listApplicationsForUser(user.id)
  const accepted = applications.find((row) => row.application.status === 'accepted')
  const program = accepted ? await getProgramById(accepted.application.programId) : null
  const resources = await listRecommendedResources(user.journeyStage)

  const nextMilestone = program?.timeline?.[0]

  // Hardcoded Learning Playbooks based on the "student to founder" pipeline requirement
  const learningPlaybooks = [
    { title: 'Growth & Scaling Strategies', progress: 75, status: 'in-progress' },
    { title: 'Fundraising Prep: Seed Round', progress: 10, status: 'in-progress' },
    { title: 'Building a Go-To-Market Team', progress: 0, status: 'locked' }
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Top Row: Command Center */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <NextStepCard
            eyebrow="Next milestone"
            heading={nextMilestone?.label ?? program?.title ?? 'Start Your Application'}
            body={nextMilestone?.description || (program ? `You're in ${program.title}. Keep building!` : 'Find a program to accelerate your startup.')}
            actionLabel={program ? 'View Program Details' : 'Browse Programs'}
            actionHref={program ? '/dashboard/applications' : '/programs'}
          />
        </div>
        {isLabBookingEnabled() && (
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-sm flex-1 flex flex-col justify-center items-start">
              <Heading as="h3" size="heading" uppercase={false} className="mb-2">Lab & Infrastructure</Heading>
              <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)] mb-4">Book maker spaces, founder cabins, and studios.</p>
              <LinkCard href="/dashboard/lab-booking" label="Book a Space" className="w-full hover:border-[var(--color-signal)]/50">
                <span className="font-medium text-[var(--color-ink)] transition-colors">Book a Space</span>
              </LinkCard>
            </div>
          </div>
        )}
      </section>

      {/* Middle Row: Bento Grid (Learning Hub & Applications) */}
      <section className="grid gap-6 lg:grid-cols-12">
        
        {/* Learning Hub Widget (Spans 7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <Heading as="h2" size="heading" uppercase={false}>
              Founder Playbooks
            </Heading>
            <span className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-[length:var(--text-small)] font-medium text-white">
              Phase 2
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

        {/* Applications Widget (Spans 5 cols) */}
        <div className="lg:col-span-5 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-sm">
          <Heading as="h2" size="heading" className="mb-6" uppercase={false}>
            Your applications
          </Heading>
          {applications.length === 0 ? (
            <EmptyState headingLevel="h3" className="mt-2 flex-1 border-none shadow-none" heading="Nothing here yet." body="You haven't applied to anything yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {applications.slice(0, 4).map(({ application, programTitle }) => (
                <div
                  key={application.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-4 hover:border-[var(--color-signal)]/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-[var(--color-ink)] line-clamp-1">{programTitle}</p>
                    <ApplicationStatusBadge status={application.status} />
                  </div>
                  <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {application.submittedAt ? `Submitted ${formatDate(application.submittedAt)}` : 'Not submitted'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bottom Row: Resources feed */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <Heading as="h2" size="heading" className="mb-6" uppercase={false}>
          Resources for your stage
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
