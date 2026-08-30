import type { Metadata } from 'next'
import { ButtonLink, Card, EmptyState, Heading, Section } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { requireUser } from '@/server/auth/guards'
import { listApplicationsForUser } from '@/server/applications/actions'
import { ApplicationStatusBadge } from './status-badge'

export const metadata: Metadata = { title: 'Your applications' }

export default async function ApplicationsPage() {
  const user = await requireUser('/dashboard/applications')
  const rows = await listApplicationsForUser(user.id)

  return (
    <Section>
      <Heading as="h1" size="display">
        Your applications
      </Heading>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            heading="Nothing here yet"
            body="You haven't applied to anything yet. When you do, you'll be able to track it here."
            action={<ButtonLink href="/programs">Browse programs</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {rows.map(({ application, programTitle, programSlug }) => (
            <Card key={application.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Heading as="h2" size="heading">
                  {programTitle}
                </Heading>
                <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {application.submittedAt ? `Submitted ${formatDate(application.submittedAt)}` : 'Not submitted'}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <ApplicationStatusBadge status={application.status} />
                {application.status === 'draft' && programSlug ? (
                  <ButtonLink href={`/apply/${programSlug}`} size="sm">
                    Continue
                  </ButtonLink>
                ) : programSlug ? (
                  <ButtonLink href={`/programs/${programSlug}`} variant="secondary" size="sm">
                    View program
                  </ButtonLink>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Section>
  )
}
