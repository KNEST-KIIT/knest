import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink, Card, EmptyState, Heading, Section, StatusBadge } from '@/components/ui'
import { LAB_BOOKING_STATUS } from '@/lib/status-config'
import { requireOnboardedUser } from '@/server/auth/guards'
import { listBookableSpaces } from '@/server/content/infrastructure'
import { hasCapability, levelRequiredFor } from '@/server/founders/levels'
import { listBookingsForUser } from '@/server/labs/actions'
import { formatCampusDate, formatCampusRange } from '@/server/labs/hours'
import { CancelButton } from './cancel-button'

export const metadata: Metadata = { title: 'Labs' }

/**
 * Labs across KIIT, and what you have booked in them.
 *
 * KNEST brokers access to rooms it does not own, so what a founder sees here is
 * a set of requests and their answers rather than a calendar they control. The
 * copy says so: nothing on this page implies a slot is theirs until the school
 * that owns the room has said yes.
 *
 * A founder below the level a space needs still sees it, greyed, with the level
 * it needs. Hiding it would leave the ladder abstract — "level 3 unlocks lab
 * booking" means more when you can see the actual rooms it opens.
 */
export default async function LabsPage() {
  const user = await requireOnboardedUser('/dashboard/labs')
  const [spaces, bookings] = await Promise.all([
    listBookableSpaces(),
    listBookingsForUser(user.id),
  ])

  const canBook = hasCapability(user.founderLevel, 'book_lab')
  const bookLabLevel = levelRequiredFor('book_lab')
  const spaceName = (id: number) => spaces.find((space) => space.id === id)?.name ?? 'A space'

  const now = Date.now()
  const upcoming = bookings.filter((booking) => booking.endsAt.getTime() >= now)
  const past = bookings.filter((booking) => booking.endsAt.getTime() < now)

  return (
    <Section>
      <Heading as="h1" size="display">
        Labs
      </Heading>
      <p className="mt-3 max-w-[62ch] text-[var(--color-ink-soft)]">
        Labs across KIIT schools, on one platform. KNEST doesn’t own these rooms — each school
        does — so a booking is a request until that lab’s manager answers it.
      </p>

      {!canBook && (
        <Card className="mt-6">
          <p className="text-[var(--color-ink-soft)]">
            Booking lab time unlocks at level {bookLabLevel}. You’re at level {user.founderLevel}.{' '}
            <Link href="/dashboard/level" className="underline underline-offset-4">
              See what each level needs
            </Link>
            .
          </p>
        </Card>
      )}

      {bookings.length > 0 && (
        <div className="mt-10">
          <Heading as="h2" size="heading">
            Your bookings
          </Heading>
          <div className="mt-4 flex flex-col gap-3">
            {[...upcoming, ...past].map((booking) => (
              <Card
                key={booking.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{spaceName(booking.labId)}</p>
                  <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {formatCampusDate(booking.startsAt)} ·{' '}
                    {formatCampusRange(booking.startsAt, booking.endsAt)} IST
                  </p>
                  {booking.decisionNote && (
                    <p className="mt-2 max-w-[60ch] text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                      {booking.decisionNote}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={booking.status} config={LAB_BOOKING_STATUS} />
                  {/* Only for a slot that has not happened yet: cancelling
                      something already past would be a lie about giving a room
                      back. */}
                  {booking.endsAt.getTime() >= now &&
                    (booking.status === 'requested' || booking.status === 'approved') && (
                      <CancelButton bookingId={booking.id} />
                    )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <Heading as="h2" size="heading">
          Spaces you can ask for
        </Heading>

        {spaces.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              heading="No bookable spaces yet"
              body="Schools are still coming onto the platform. When one opens a lab for booking, it will show up here."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {spaces.map((space) => {
              const minimum = space.minimumLevel ?? bookLabLevel
              const allowed = canBook && user.founderLevel >= minimum
              return (
                <Card key={space.id} className="flex flex-col gap-3">
                  <div>
                    <p className="font-medium">{space.name}</p>
                    {space.owningSchool && (
                      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                        {space.owningSchool}
                      </p>
                    )}
                  </div>
                  {space.summary && (
                    <p className="text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                      {space.summary}
                    </p>
                  )}
                  <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {space.location ? `${space.location} · ` : ''}
                    {space.slotMinutes ?? 60} minute slots
                  </p>
                  {allowed ? (
                    <ButtonLink href={`/dashboard/labs/${space.slug}`} variant="secondary">
                      Find a slot
                    </ButtonLink>
                  ) : (
                    <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                      Opens at level {minimum}
                      {space.owningSchool ? `, set by ${space.owningSchool}` : ''}.
                    </p>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </Section>
  )
}
