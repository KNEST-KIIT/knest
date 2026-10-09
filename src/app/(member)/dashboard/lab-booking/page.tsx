import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EmptyState, Heading } from '@/components/ui'
import { nowMs } from '@/lib/clock'
import { rangeLabel, STATUS_LABELS } from '@/lib/lab-format'
import { requireOnboardedUser } from '@/server/auth/guards'
import { isLabBookingEnabled } from '@/server/features'
import { listActiveLabs, listMyBookings } from '@/server/labs/service'
import { BookingActions } from './booking-actions'

export const metadata = { title: 'Lab booking' }
export const dynamic = 'force-dynamic'

export default async function LabBookingPage() {
  if (!isLabBookingEnabled()) notFound()
  const user = await requireOnboardedUser('/dashboard/lab-booking')
  const [labs, mine] = await Promise.all([listActiveLabs(), listMyBookings(user.id)])
  const now = nowMs()

  return (
    <div className="mx-auto max-w-4xl space-y-12 pb-12">
      <div>
        <Heading as="h1" size="title">
          Lab booking
        </Heading>
        <p className="mt-2 text-[var(--color-ink-soft)]">Request time in a lab. The lab head approves each request, and you hear back by email and here.</p>
      </div>

      <section aria-labelledby="labs">
        <Heading as="h2" size="heading">
          <span id="labs">Labs you can book</span>
        </Heading>
        {labs.length === 0 ? (
          <div className="mt-4">
            <EmptyState heading="No labs are open for booking yet" body="When a lab opens for booking it will appear here." size="compact" />
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {labs.map((lab) => (
              <li key={lab.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
                <p className="font-semibold">{lab.name}</p>
                <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {lab.department ? `${lab.department} · ` : ''}up to {lab.capacity} {lab.capacity === 1 ? 'person' : 'people'}
                </p>
                <Link href={`/dashboard/lab-booking/${lab.slug}`} className="mt-3 inline-block font-semibold text-[var(--color-signal)] underline underline-offset-4">
                  See times and book
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="mine">
        <Heading as="h2" size="heading">
          <span id="mine">Your bookings</span>
        </Heading>
        {mine.length === 0 ? (
          <p className="mt-4 text-[var(--color-ink-muted)]">You haven’t requested any lab time yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {mine.map(({ booking, labName, labSlug }) => {
              const live = ['requested', 'approved', 'alternative_proposed'].includes(booking.status)
              const upcoming = booking.endsAt.getTime() >= now
              return (
                <li key={booking.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        <Link href={`/dashboard/lab-booking/${labSlug}`} className="underline underline-offset-4">
                          {labName}
                        </Link>
                      </p>
                      <p className="text-[length:var(--text-small)]">{rangeLabel(booking.startsAt, booking.endsAt)}</p>
                    </div>
                    <span className="rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-2 py-1 text-xs font-bold uppercase tracking-wide">{STATUS_LABELS[booking.status] ?? booking.status}</span>
                  </div>
                  <p className="mt-2 text-[var(--color-ink-soft)]">{booking.purpose}</p>
                  {booking.status === 'alternative_proposed' && booking.proposedStartsAt && booking.proposedEndsAt && (
                    <p className="mt-2 text-[length:var(--text-small)]">
                      <strong>Suggested instead:</strong> {rangeLabel(booking.proposedStartsAt, booking.proposedEndsAt)}. Nothing is booked until you accept.
                    </p>
                  )}
                  {booking.decisionNote && (booking.status === 'rejected' || booking.status === 'cancelled' || booking.status === 'alternative_proposed' || booking.status === 'approved') && (
                    <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Note from the lab: {booking.decisionNote}</p>
                  )}
                  {live && upcoming && (
                    <div className="mt-4">
                      <BookingActions id={booking.id} status={booking.status} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
