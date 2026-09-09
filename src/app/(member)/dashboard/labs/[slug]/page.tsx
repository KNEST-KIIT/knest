import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, Heading, Section } from '@/components/ui'
import { requireOnboardedUser } from '@/server/auth/guards'
import { getSpaceBySlug } from '@/server/content/infrastructure'
import { hasCapability } from '@/server/founders/levels'
import { listHeldSlots } from '@/server/labs/actions'
import {
  campusDayKey,
  campusMoment,
  formatCampusDate,
  openWindowsFor,
  slotsForDay,
} from '@/server/labs/hours'
import { BookingForm } from './booking-form'

export const metadata: Metadata = { title: 'Book a lab' }

/** How many days of the picker to build. Bounded by the space's own horizon. */
const WINDOW_DAYS = 14

/**
 * Picking a slot in one space.
 *
 * The slots offered here come from the same `slotsForDay` the server validates
 * against, so the picker cannot show a slot the action would refuse. That is
 * the point of putting the arithmetic in one pure module rather than deriving
 * open hours twice.
 *
 * Approved bookings are greyed out, but only as a courtesy: the real arbiter is
 * the `lab_bookings_no_overlap` exclusion constraint at approval time. Two
 * founders may ask for the same hour and both requests are valid — the clash is
 * settled when a manager approves one, not when a page renders.
 */
export default async function LabBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireOnboardedUser(`/dashboard/labs/${slug}`)

  const space = await getSpaceBySlug(slug)
  if (!space || !space.bookable) notFound()

  const minimum = space.minimumLevel ?? 3
  const slotMinutes = space.slotMinutes ?? 60
  const maxAdvanceDays = space.maxAdvanceDays ?? 30
  const canBook = hasCapability(user.founderLevel, 'book_lab') && user.founderLevel >= minimum
  const canExtend = hasCapability(user.founderLevel, 'lab_extended_slots')

  const horizonDays = Math.min(WINDOW_DAYS, maxAdvanceDays)
  const from = new Date()
  const to = new Date(Date.now() + horizonDays * 86_400_000)
  const held = canBook ? await listHeldSlots(space.id, from, to) : []

  // Built server-side so the client component never re-derives opening hours —
  // it renders a list it was handed.
  const days = []
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const at = new Date(Date.now() + offset * 86_400_000)
    const moment = campusMoment(at)
    if (openWindowsFor(space.openHours, moment.weekday).length === 0) continue

    const slots = slotsForDay(space.openHours, slotMinutes, moment.year, moment.month, moment.day)
      .filter((slot) => slot.startsAt.getTime() > Date.now())
      .map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        label: slot.label,
        taken: held.some(
          (booking) =>
            booking.startsAt.getTime() < slot.endsAt.getTime() &&
            booking.endsAt.getTime() > slot.startsAt.getTime(),
        ),
      }))
    if (slots.length === 0) continue

    days.push({ key: campusDayKey(at), label: formatCampusDate(at), slots })
  }

  return (
    <Section>
      <Link
        href="/dashboard/labs"
        className="inline-flex h-11 items-center text-[length:var(--text-small)] underline underline-offset-4"
      >
        ← All labs
      </Link>

      <Heading as="h1" size="display" className="mt-4">
        {space.name}
      </Heading>
      <p className="mt-3 max-w-[62ch] text-[var(--color-ink-soft)]">
        {space.owningSchool ? `${space.owningSchool}. ` : ''}
        {space.summary}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {!canBook ? (
            <Card>
              <p className="text-[var(--color-ink-soft)]">
                {space.name} is open to founders at level {minimum} and above. You’re at level{' '}
                {user.founderLevel}.{' '}
                <Link href="/dashboard/level" className="underline underline-offset-4">
                  See what level {minimum} needs
                </Link>
                .
              </p>
            </Card>
          ) : days.length === 0 ? (
            <Card>
              <p className="text-[var(--color-ink-soft)]">
                Nothing open in the next {horizonDays} days. The lab sets its own hours, so this
                changes when they do.
              </p>
            </Card>
          ) : (
            <BookingForm
              labId={space.id}
              labName={space.name}
              slotMinutes={slotMinutes}
              maxSlots={canExtend ? 4 : 1}
              canExtend={canExtend}
              days={days}
            />
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <Heading as="h2" size="heading">
              The space
            </Heading>
            <dl className="mt-4 flex flex-col gap-3 text-[length:var(--text-small)]">
              {space.location && <Fact label="Where" value={space.location} />}
              {space.capacity != null && <Fact label="Capacity" value={`${space.capacity} people`} />}
              <Fact label="Slot length" value={`${slotMinutes} minutes`} />
              <Fact label="Book ahead" value={`Up to ${maxAdvanceDays} days`} />
              <Fact label="Minimum level" value={`Level ${minimum}`} />
            </dl>
            {space.equipment && space.equipment.length > 0 && (
              <>
                <h3 className="mt-6 text-[length:var(--text-micro)] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                  Equipment
                </h3>
                <ul className="mt-2 flex flex-col gap-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                  {space.equipment.map((entry) => (
                    <li key={entry.id ?? entry.item}>{entry.item}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </aside>
      </div>
    </Section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
