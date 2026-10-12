import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Heading } from '@/components/ui'
import { nowMs } from '@/lib/clock'
import { rangeLabel, STATUS_LABELS } from '@/lib/lab-format'
import { requireOnboardedUser } from '@/server/auth/guards'
import { actorFor, canManage, canStaff } from '@/server/labs/access'
import { formatEventTime } from '@/lib/dates'
import { listDepartments } from '@/server/labs/department-admin'
import { orderTree } from '@/server/labs/departments'
import { getLabBySlug, listDecisionHistory, listLabBookings, listLabStaff } from '@/server/labs/service'
import { AttendanceControls, BlackoutManager, CancelControls, DecisionControls, HoursEditor, SettingsForm, StaffManager } from './controls'

export const metadata = { title: 'Lab console' }
export const dynamic = 'force-dynamic'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
      <Heading as="h2" size="heading">
        <span id={id}>{title}</span>
      </Heading>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default async function LabConsolePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await requireOnboardedUser(`/dashboard/lab-staff/${slug}`)
  const found = await getLabBySlug(slug)
  if (!found) notFound()
  const { lab, hours, blackouts } = found
  const actor = await actorFor(lab.id)
  if (!canStaff(actor)) notFound()
  const manager = canManage(actor)

  // An assistant sees only the bookings assigned to them, never the other people who booked the lab.
  const onlyMine = manager ? undefined : actor.id
  const [open, upcoming, past, staff, history, departments] = await Promise.all([
    manager ? listLabBookings(lab.id, 'open') : Promise.resolve([]),
    listLabBookings(lab.id, 'upcoming', onlyMine),
    listLabBookings(lab.id, 'past', onlyMine),
    listLabStaff(lab.id),
    manager ? listDecisionHistory(lab.id, 30) : Promise.resolve([]),
    actor.isAdmin ? listDepartments() : Promise.resolve([]),
  ])
  const departmentOptions = orderTree(departments).map((d) => ({ id: d.id, label: `${'— '.repeat(d.depth)}${d.name}` }))
  const ACTION_LABELS: Record<string, string> = {
    lab_booking_approved: 'Approved',
    lab_booking_rejected: 'Declined',
    lab_booking_alternative_proposed: 'Suggested another time',
    lab_booking_cancelled: 'Cancelled',
    lab_attendance_attended: 'Marked attended',
    lab_attendance_no_show: 'Marked no-show',
  }
  const staffOptions = staff.map((s) => ({ userId: s.userId, label: s.name ?? s.email }))
  const now = nowMs()
  const who = (name: string | null, email: string) => (name ? `${name} (${email})` : email)

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div>
        <Link href="/dashboard/lab-staff" className="text-sm font-semibold text-[var(--color-signal)] underline underline-offset-4">
          ← Your labs
        </Link>
        <Heading as="h1" size="title" className="mt-4">
          {lab.name}
        </Heading>
        <p className="text-[var(--color-ink-muted)]">
          {actor.isAdmin ? 'Lab administrator' : actor.role === 'head' ? 'Lab head' : 'Lab assistant'}
          {!lab.isActive ? ' · closed for booking' : ''}
        </p>
        {!manager && <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">You see the bookings assigned to you. Other bookings in this lab are not shown to assistants.</p>}
      </div>

      {manager && (
        <Section id="requests" title={`Requests waiting (${open.length})`}>
          {open.length === 0 ? (
            <p className="text-[var(--color-ink-muted)]">Nothing is waiting for a decision.</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {open.map(({ booking, memberName, memberEmail }) => (
                <li key={booking.id} className="border-b border-[var(--color-line)] pb-5 last:border-0 last:pb-0">
                  <p className="font-semibold">{who(memberName, memberEmail)}</p>
                  <p className="text-[length:var(--text-small)]">
                    {rangeLabel(booking.startsAt, booking.endsAt)} · {booking.headcount} {booking.headcount === 1 ? 'person' : 'people'}
                  </p>
                  <p className="mt-1 text-[var(--color-ink-soft)]">{booking.purpose}</p>
                  {booking.equipment && <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Equipment: {booking.equipment}</p>}
                  {booking.status === 'alternative_proposed' ? (
                    <p className="mt-2 text-[length:var(--text-small)] font-semibold">
                      Waiting for them to answer your suggestion: {booking.proposedStartsAt && booking.proposedEndsAt ? rangeLabel(booking.proposedStartsAt, booking.proposedEndsAt) : ''}
                    </p>
                  ) : (
                    <div className="mt-3">
                      <DecisionControls id={booking.id} staff={staffOptions} requiresAssistant={lab.requiresAssistant} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section id="upcoming" title={`Approved and coming up (${upcoming.length})`}>
        {upcoming.length === 0 ? (
          <p className="text-[var(--color-ink-muted)]">No approved bookings ahead.</p>
        ) : (
          <ul className="flex flex-col gap-5">
            {upcoming.map(({ booking, memberName, memberEmail }) => {
              const started = booking.startsAt.getTime() <= now
              const assistant = staff.find((s) => s.userId === booking.assistantUserId)
              return (
                <li key={booking.id} className="border-b border-[var(--color-line)] pb-5 last:border-0 last:pb-0">
                  <p className="font-semibold">{who(memberName, memberEmail)}</p>
                  <p className="text-[length:var(--text-small)]">
                    {rangeLabel(booking.startsAt, booking.endsAt)} · {booking.headcount} {booking.headcount === 1 ? 'person' : 'people'}
                    {assistant ? ` · assistant: ${assistant.name ?? assistant.email}` : ''}
                  </p>
                  <p className="mt-1 text-[var(--color-ink-soft)]">{booking.purpose}</p>
                  <div className="mt-3 flex flex-col gap-3">
                    {started ? <AttendanceControls id={booking.id} /> : <p className="text-xs text-[var(--color-ink-muted)]">Attendance can be recorded once it has started.</p>}
                    {manager && <CancelControls id={booking.id} />}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section id="past" title="Recent history">
        {past.length === 0 ? (
          <p className="text-[var(--color-ink-muted)]">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] text-[length:var(--text-small)]">
            {past.slice(0, 30).map(({ booking, memberName, memberEmail }) => (
              <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {who(memberName, memberEmail)}, {rangeLabel(booking.startsAt, booking.endsAt)}
                </span>
                <strong>{STATUS_LABELS[booking.status] ?? booking.status}</strong>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {manager && (
        <Section id="decisions" title="Decision history">
          {history.length === 0 ? (
            <p className="text-[var(--color-ink-muted)]">No decisions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)] text-[length:var(--text-small)]">
              {history.map((h) => (
                <li key={h.id} className="py-2">
                  <p>
                    <strong>{ACTION_LABELS[h.action] ?? h.action}</strong> by {who(h.actorName, h.actorEmail)}
                    {h.override && <span className="ml-2 rounded bg-[var(--color-ink)] px-2 py-0.5 text-xs font-bold uppercase text-white">Administrator override</span>}
                  </p>
                  <p className="text-[var(--color-ink-muted)]">
                    {formatEventTime(h.at)}
                    {h.note ? ` · ${h.note}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {manager && (
        <>
          <Section id="settings" title="Rules and details">
            <SettingsForm
              slug={lab.slug}
              isAdmin={actor.isAdmin}
              isActive={lab.isActive}
              departments={departmentOptions}
              values={{
                escalateAfterHours: lab.escalateAfterHours,
                departmentId: lab.departmentId,
                name: lab.name,
                department: lab.department,
                description: lab.description ?? '',
                capacity: lab.capacity,
                slotMinutes: lab.slotMinutes,
                maxConsecutiveSlots: lab.maxConsecutiveSlots,
                minLeadMinutes: lab.minLeadMinutes,
                maxHorizonDays: lab.maxHorizonDays,
                maxOpenRequests: lab.maxOpenRequests,
                maxHoursPerWeek: lab.maxHoursPerWeek,
                cancelCutoffMinutes: lab.cancelCutoffMinutes,
                eligibility: lab.eligibility,
                requiresAssistant: lab.requiresAssistant,
              }}
            />
          </Section>
          <Section id="hours" title="Opening hours">
            <HoursEditor slug={lab.slug} initial={hours.map((h) => ({ weekday: h.weekday, opensMinute: h.opensMinute, closesMinute: h.closesMinute }))} />
          </Section>
          <Section id="closed" title="Closed dates">
            <BlackoutManager slug={lab.slug} blackouts={blackouts.map((b) => ({ id: b.id, startsOn: b.startsOn, endsOn: b.endsOn, reason: b.reason }))} />
          </Section>
          <Section id="staff" title="Head and assistants">
            <StaffManager slug={lab.slug} isAdmin={actor.isAdmin} staff={staff.map((s) => ({ id: s.id, role: s.role, label: s.name ?? s.email }))} />
          </Section>
          <p>
            <Link href={`/dashboard/lab-staff/${lab.slug}/report`} className="font-semibold text-[var(--color-signal)] underline underline-offset-4">
              Utilisation report for this lab
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
