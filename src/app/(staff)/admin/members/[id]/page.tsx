import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, EmptyState, Heading, StatusBadge } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { APPLICATION_STATUS, LAB_BOOKING_STATUS, LEVEL_REQUEST_STATUS } from '@/lib/status-config'
import { getSessionUser } from '@/server/auth/guards'
import { capabilitiesFor, capabilityLabel, levelDefinition } from '@/server/founders/levels'
import { getMemberDetail } from '@/server/members/directory'
import { AccountStatusForm, StaffRoleForm } from './staff-form'

export const metadata: Metadata = { title: 'Member — Admin' }

/**
 * One person, everything about them.
 *
 * The application review screen already loaded the full user row and rendered
 * only a name and an email — journey stage, school, goals, history all fetched
 * and discarded. This is where a reviewer can actually see who they are
 * deciding about.
 */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [detail, viewer] = await Promise.all([getMemberDetail(id), getSessionUser()])
  if (!detail) notFound()

  const { member, applications, registrations, levels, bookings, actions } = detail
  const level = levelDefinition(member.founderLevel)
  const capabilities = capabilitiesFor(member.founderLevel)
  // Both writes are super_admin-only and both refuse self-targeting, in
  // `setStaffRole`/`setMemberActive`. This mirrors that so the console does not
  // offer a control that will refuse — the server checks are still the gate.
  const canAdminister = viewer?.staffRole === 'super_admin' && viewer.id !== member.id

  return (
    <div>
      <Link href="/admin/members" className="inline-flex h-11 items-center text-[length:var(--text-small)] underline underline-offset-4">
        ← All members
      </Link>

      <Heading as="h1" size="title" className="mt-4">
        {member.name ?? member.email}
      </Heading>
      <p className="mt-2 text-[var(--color-ink-soft)]">
        {member.email}
        {!member.isActive && ' · deactivated'}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          <section>
            <Heading as="h2" size="heading">
              Profile
            </Heading>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Detail label="Platform role" value={member.platformRole} />
              {/* The two halves of a founder's standing, next to each other. */}
              <Detail label="Says they are" value={member.journeyStage ?? 'Not said'} />
              <Detail label="KNEST verified" value={`Level ${member.founderLevel} · ${level.label}`} />
              <Detail
                label="Level granted"
                value={member.founderLevelGrantedAt ? formatDate(member.founderLevelGrantedAt) : 'Never'}
              />
              <Detail label="School" value={member.school ?? '—'} />
              <Detail label="Joined" value={formatDate(member.createdAt)} />
              <Detail
                label="Onboarding"
                value={member.onboardingCompletedAt ? formatDate(member.onboardingCompletedAt) : 'Not finished'}
              />
            </dl>
            {capabilities.length > 0 && (
              <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                Unlocked: {capabilities.map(capabilityLabel).join(', ')}
              </p>
            )}
          </section>

          <History title="Applications" empty="No applications." rows={applications}
            render={(row) => (
              <>
                <span>{formatDate(row.createdAt)}</span>
                <StatusBadge status={row.status} config={APPLICATION_STATUS} />
              </>
            )}
          />

          <History title="Level requests" empty="Never asked to move up." rows={levels}
            render={(row) => (
              <>
                <span>
                  {formatDate(row.createdAt)} · asked for level {row.requestedLevel}
                </span>
                <StatusBadge status={row.status} config={LEVEL_REQUEST_STATUS} />
              </>
            )}
          />

          <History title="Lab bookings" empty="No lab bookings." rows={bookings}
            render={(row) => (
              <>
                <span>{formatDate(row.startsAt)}</span>
                <StatusBadge status={row.status} config={LAB_BOOKING_STATUS} />
              </>
            )}
          />

          <History title="Events" empty="No event registrations." rows={registrations}
            render={(row) => <span>Registered {formatDate(row.registeredAt)}</span>}
          />

          <section>
            <Heading as="h2" size="heading">
              Staff actions on this account
            </Heading>
            {/* The audit log had no reader anywhere before this. */}
            {actions.length === 0 ? (
              <p className="mt-4 text-[var(--color-ink-soft)]">Nothing recorded.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {actions.map((entry) => (
                  <li key={entry.id} className="text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {formatDate(entry.createdAt)} · {entry.action}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside>
          <Card>
            <Heading as="h2" size="heading">
              Access
            </Heading>
            <div className="mt-4">
              <StaffRoleForm
                userId={member.id}
                current={member.staffRole}
                canEdit={canAdminister}
              />
            </div>
            {canAdminister && (
              <div className="mt-6 border-t border-[var(--color-line)] pt-6">
                <AccountStatusForm userId={member.id} isActive={member.isActive} />
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[length:var(--text-micro)] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
        {label}
      </dt>
      <dd className="mt-1">{value}</dd>
    </div>
  )
}

function History<T extends { id: string }>({
  title,
  empty,
  rows,
  render,
}: {
  title: string
  empty: string
  rows: T[]
  render: (row: T) => React.ReactNode
}) {
  return (
    <section>
      <Heading as="h2" size="heading">
        {title}
      </Heading>
      {rows.length === 0 ? (
        <p className="mt-4 text-[var(--color-ink-soft)]">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] py-2">
              {render(row)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
