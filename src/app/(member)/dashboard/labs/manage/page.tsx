import type { Metadata } from 'next'
import { ButtonLink, Card, EmptyState, Heading, Section, StatusBadge } from '@/components/ui'
import { LAB_BOOKING_STATUS } from '@/lib/status-config'
import { requireUser } from '@/server/auth/guards'
import { levelDefinition } from '@/server/founders/levels'
import { formatCampusDate, formatCampusRange } from '@/server/labs/hours'
import { listBookingsForManager } from '@/server/labs/review'
import { DecisionButtons } from './decision-buttons'

export const metadata: Metadata = { title: 'Lab requests' }

/**
 * The lab manager's queue.
 *
 * Under `/dashboard` and not `/admin`, which is the whole point. A lab manager
 * is a professor in another KIIT school with no `staffRole`, and the entire
 * `(staff)` route group calls `requireStaff()`, which `notFound()`s anyone
 * without one — putting this at `/admin/labs/bookings` would have 404'd every
 * person it exists for.
 *
 * Access is per-entity: `listBookingsForManager` returns only the spaces this
 * account is named a manager of, so the scoping is in the query rather than in
 * what gets rendered.
 */
export default async function ManageLabsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireUser('/dashboard/labs/manage')
  const params = await searchParams
  const status = params.status ?? 'requested'

  const { spaces, rows } = await listBookingsForManager({ status })

  // Someone who manages nothing gets told so, rather than a `notFound()`.
  // The parent dashboard layout has already flushed by the time this renders,
  // so `notFound()` here cannot set a 404 status anyway — it produces a 200
  // carrying a 404 page inside the member chrome, which is worse than an
  // honest sentence. There is nothing to protect: the queue itself is scoped
  // in the query, so no booking reaches this page to be hidden.
  if (spaces.length === 0) {
    return (
      <Section>
        <Heading as="h1" size="display">
          Lab requests
        </Heading>
        <div className="mt-8">
          <EmptyState
            heading="This page is for lab managers"
            body="KIIT schools that make a space bookable name the people who decide on requests for it. You aren’t on any of those lists, so there’s nothing here for you to answer."
            action={<ButtonLink href="/dashboard/labs">Browse labs instead</ButtonLink>}
          />
        </div>
      </Section>
    )
  }

  const spaceName = (id: number) => spaces.find((space) => space.id === id)?.name ?? 'A space'

  return (
    <Section>
      <Heading as="h1" size="display">
        Lab requests
      </Heading>
      <p className="mt-3 max-w-[60ch] text-[var(--color-ink-soft)]">
        {spaces.length === 1
          ? `Requests for ${spaces[0]!.name}.`
          : `Requests across ${spaces.length} spaces you manage.`}{' '}
        Approving one holds the room; the slot is then closed to everyone else.
      </p>

      <nav aria-label="Filter" className="mt-6 flex flex-wrap gap-2">
        {[
          { value: 'requested', label: 'Waiting on you' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Declined' },
          { value: '', label: 'Everything' },
        ].map((option) => (
          <a
            key={option.label}
            href={option.value ? `/dashboard/labs/manage?status=${option.value}` : '/dashboard/labs/manage?status='}
            aria-current={status === option.value ? 'page' : undefined}
            className={`flex h-11 items-center rounded-[var(--radius-sm)] border px-4 text-[length:var(--text-small)] ${
              status === option.value
                ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                : 'border-[var(--color-line)]'
            }`}
          >
            {option.label}
          </a>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            heading="Nothing waiting"
            body="When a founder asks for time in one of your spaces, it will appear here."
          />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {rows.map((booking) => {
            const level = levelDefinition(booking.user?.founderLevel ?? 1)
            return (
              <Card key={booking.id} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{spaceName(booking.labId)}</p>
                    <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                      {formatCampusDate(booking.startsAt)} · {formatCampusRange(booking.startsAt, booking.endsAt)} IST
                    </p>
                  </div>
                  <StatusBadge status={booking.status} config={LAB_BOOKING_STATUS} />
                </div>

                <div>
                  <p className="text-[length:var(--text-small)]">
                    {booking.user?.name ?? booking.user?.email ?? 'A founder'}
                    <span className="text-[var(--color-ink-muted)]">
                      {' '}
                      · level {level.level} ({level.label})
                      {(booking.user?.founderLevel ?? 1) >= 5 && ' · priority'}
                    </span>
                  </p>
                  <p className="mt-2 max-w-[68ch] whitespace-pre-wrap text-[var(--color-ink-soft)]">
                    {booking.purpose}
                  </p>
                </div>

                {booking.status === 'requested' ? (
                  <DecisionButtons bookingId={booking.id} />
                ) : (
                  booking.decisionNote && (
                    <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                      {booking.decisionNote}
                    </p>
                  )
                )}
              </Card>
            )
          })}
        </div>
      )}
    </Section>
  )
}
