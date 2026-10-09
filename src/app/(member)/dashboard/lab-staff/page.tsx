import Link from 'next/link'
import { notFound } from 'next/navigation'
import { inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { labs } from '@/db/schema'
import { EmptyState, Heading } from '@/components/ui'
import { rangeLabel } from '@/lib/lab-format'
import { requireOnboardedUser } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'
import { isLabBookingEnabled } from '@/server/features'
import { isLabAdmin, labsRunBy } from '@/server/labs/access'
import { listActiveLabs, listRoster } from '@/server/labs/service'

export const metadata = { title: 'Your labs' }
export const dynamic = 'force-dynamic'

export default async function LabStaffHome() {
  if (!isLabBookingEnabled()) notFound()
  const user = await requireOnboardedUser('/dashboard/lab-staff')
  const admin = isLabAdmin((user.staffRole ?? null) as StaffRole | null)
  const mine = await labsRunBy(user.id)
  if (!admin && mine.length === 0) notFound()

  const roles = new Map(mine.map((m) => [m.labId, m.role]))
  const rows = admin ? await listActiveLabs() : await db.select().from(labs).where(inArray(labs.id, mine.map((m) => m.labId)))
  const roster = await listRoster(user.id)

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-12">
      <Heading as="h1" size="title">
        Your labs
      </Heading>

      {rows.length === 0 ? (
        <EmptyState heading="No labs yet" body="Labs appear here once a lab administrator creates them." size="compact" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((lab) => (
            <li key={lab.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
              <p className="font-semibold">{lab.name}</p>
              <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                {admin ? 'Lab administrator' : roles.get(lab.id) === 'head' ? 'Lab head' : 'Lab assistant'}
                {lab.isActive ? '' : ' · closed for booking'}
              </p>
              <Link href={`/dashboard/lab-staff/${lab.slug}`} className="mt-3 inline-block font-semibold text-[var(--color-signal)] underline underline-offset-4">
                Open console
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="duties">
        <Heading as="h2" size="heading">
          <span id="duties">Your duties coming up</span>
        </Heading>
        {roster.length === 0 ? (
          <p className="mt-3 text-[var(--color-ink-muted)]">No bookings are assigned to you.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
            {roster.map(({ booking, labName, labSlug, memberName }) => (
              <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[length:var(--text-small)]">
                <span>
                  <strong>{labName}</strong>: {rangeLabel(booking.startsAt, booking.endsAt)} · {memberName ?? 'a member'}
                </span>
                <Link href={`/dashboard/lab-staff/${labSlug}`} className="font-semibold text-[var(--color-signal)] underline underline-offset-4">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {admin && (
        <p>
          <Link href="/admin/labs" className="font-semibold text-[var(--color-signal)] underline underline-offset-4">
            Create and manage labs
          </Link>
        </p>
      )}
    </div>
  )
}
