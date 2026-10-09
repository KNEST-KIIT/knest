import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Heading } from '@/components/ui'
import { describeMinutes } from '@/server/labs/rules'
import { minuteLabel, WEEKDAYS } from '@/lib/lab-format'
import { requireOnboardedUser } from '@/server/auth/guards'
import { isLabBookingEnabled } from '@/server/features'
import { getLabBySlug } from '@/server/labs/service'
import { turnstileSiteKey } from '@/server/security/turnstile'
import { BookingPicker } from './booking-picker'

export const metadata = { title: 'Book a lab' }
export const dynamic = 'force-dynamic'

export default async function LabPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isLabBookingEnabled()) notFound()
  const { slug } = await params
  await requireOnboardedUser(`/dashboard/lab-booking/${slug}`)
  const found = await getLabBySlug(slug)
  if (!found) notFound()
  const { lab, hours, blackouts } = found

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-12">
      <div>
        <Link href="/dashboard/lab-booking" className="text-sm font-semibold text-[var(--color-signal)] underline underline-offset-4">
          ← All labs
        </Link>
        <Heading as="h1" size="title" className="mt-4">
          {lab.name}
        </Heading>
        <p className="mt-1 text-[var(--color-ink-muted)]">
          {lab.department ? `${lab.department} · ` : ''}up to {lab.capacity} {lab.capacity === 1 ? 'person' : 'people'}
        </p>
        {lab.description && <p className="mt-4 max-w-[65ch] text-[var(--color-ink-soft)]">{lab.description}</p>}
      </div>

      <section aria-labelledby="rules" className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
        <Heading as="h2" size="heading">
          <span id="rules">How booking works here</span>
        </Heading>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--color-ink-soft)]">
          <li>Times are in blocks of {lab.slotMinutes} minutes, up to {lab.maxConsecutiveSlots} in a row.</li>
          <li>Book at least {describeMinutes(lab.minLeadMinutes)} ahead, and no more than {lab.maxHorizonDays} days ahead.</li>
          <li>You can have {lab.maxOpenRequests} requests waiting at once, and up to {lab.maxHoursPerWeek} hours a week.</li>
          <li>A lab head approves each request. You can cancel up to {describeMinutes(lab.cancelCutoffMinutes)} before an approved booking.</li>
        </ul>
        <p className="mt-4 text-sm font-semibold">Opening hours (India Standard Time)</p>
        {hours.length === 0 ? (
          <p className="text-[var(--color-ink-muted)]">This lab has not set its opening hours yet.</p>
        ) : (
          <ul className="mt-1 text-[var(--color-ink-soft)]">
            {hours.map((h) => (
              <li key={`${h.weekday}-${h.opensMinute}`}>
                {WEEKDAYS[h.weekday]}: {minuteLabel(h.opensMinute)} to {minuteLabel(h.closesMinute)}
              </li>
            ))}
          </ul>
        )}
        {blackouts.length > 0 && (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Closed: {blackouts.map((b) => (b.startsOn === b.endsOn ? b.startsOn : `${b.startsOn} to ${b.endsOn}`) + (b.reason ? ` (${b.reason})` : '')).join('; ')}
          </p>
        )}
      </section>

      <section aria-labelledby="book">
        <Heading as="h2" size="heading">
          <span id="book">Request a time</span>
        </Heading>
        <div className="mt-4">
          <BookingPicker slug={lab.slug} capacity={lab.capacity} maxConsecutive={lab.maxConsecutiveSlots} horizonDays={lab.maxHorizonDays} turnstileSiteKey={turnstileSiteKey()} />
        </div>
      </section>
    </div>
  )
}
