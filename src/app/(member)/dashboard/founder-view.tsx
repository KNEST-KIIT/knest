import { EmptyState, Heading, LinkCard } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { RESOURCES_EMPTY } from '@/lib/empty-state-copy'
import { listApplicationsForUser } from '@/server/applications/actions'
import { getProgramById } from '@/server/content/programs'
import { listRecommendedResources } from '@/server/content/resources'
import type { SessionUser } from '@/server/auth/guards'
import { ApplicationStatusBadge } from './applications/status-badge'
import { NextStepCard } from './next-step-card'

export async function FounderDashboard({ user }: { user: SessionUser }) {
  const applications = await listApplicationsForUser(user.id)
  const accepted = applications.find((row) => row.application.status === 'accepted')
  const program = accepted ? await getProgramById(accepted.application.programId) : null
  const resources = await listRecommendedResources(user.journeyStage)

  // Program.timeline carries no dates (spec §4.1's "next entry whose implied
  // date hasn't passed, or the first entry if none carry dates" — none ever
  // do), so the first entry is always the one shown.
  const nextMilestone = program?.timeline?.[0]

  return (
    <>
      <section>
        <Heading as="h2" size="title">
          Your applications
        </Heading>
        {applications.length === 0 ? (
          <EmptyState headingLevel="h3"
            className="mt-6"
            heading="Nothing here yet"
            body="You haven't applied to anything yet. When you do, you'll be able to track it here."
          />
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {applications.map(({ application, programTitle, programSlug }) => (
              <div
                key={application.id}
                className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{programTitle}</p>
                  <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {application.submittedAt ? `Submitted ${formatDate(application.submittedAt)}` : 'Not submitted'}
                  </p>
                </div>
                <ApplicationStatusBadge status={application.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <Heading as="h2" size="title">
          Your program
        </Heading>
        {!program ? (
          <EmptyState headingLevel="h3"
            className="mt-6"
            heading="Your program will appear here once you're accepted."
            body="Track where your applications stand any time from the list above."
          />
        ) : (
          <div className="mt-6">
            <NextStepCard
              eyebrow="Next milestone"
              heading={nextMilestone?.label ?? program.title}
              body={nextMilestone?.description || `You're in ${program.title}.`}
              actionLabel="View program"
              actionHref="/dashboard/applications"
            />
          </div>
        )}
      </section>

      <section className="mt-12">
        <Heading as="h2" size="title">
          Resources for your stage
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
