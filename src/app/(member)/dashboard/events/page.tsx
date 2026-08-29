import type { Metadata } from 'next'
import { ButtonLink, Card, EmptyState, Heading, Section } from '@/components/ui'
import { formatEventTime } from '@/lib/dates'
import { requireUser } from '@/server/auth/guards'
import { listRegisteredEventsForUser } from '@/server/events/actions'

export const metadata: Metadata = { title: 'Your events' }

/** Mirrors dashboard/applications' pattern: requireUser only, not requireOnboardedUser — checking what you've registered for is basic account functionality, not gated behind onboarding completion (spec: never a dead end). */
export default async function DashboardEventsPage() {
  const user = await requireUser('/dashboard/events')
  const rows = await listRegisteredEventsForUser(user.id)
  const upcoming = rows.filter((r) => r.event && new Date(r.event.startsAt) > new Date())
  const past = rows.filter((r) => r.event && new Date(r.event.startsAt) <= new Date())

  return (
    <Section>
      <Heading as="h1" size="display">
        Your events
      </Heading>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            heading="Nothing here yet"
            body="You haven't registered for anything yet. When you do, you'll be able to track it here."
            action={<ButtonLink href="/events">Browse events</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-[length:var(--text-small)] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
                Upcoming
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {upcoming.map(({ event, registration }) =>
                  event ? (
                    <Card key={registration.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                          {formatEventTime(event.startsAt)}
                        </p>
                      </div>
                      <ButtonLink href={`/events/${event.slug}`} variant="secondary" size="sm">
                        View event
                      </ButtonLink>
                    </Card>
                  ) : null,
                )}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-[length:var(--text-small)] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
                Past
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {past.map(({ event, registration }) =>
                  event ? (
                    <Card key={registration.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between opacity-70">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                          {formatEventTime(event.startsAt)}
                        </p>
                      </div>
                    </Card>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
