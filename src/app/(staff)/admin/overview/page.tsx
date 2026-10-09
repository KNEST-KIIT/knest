import type { Metadata } from 'next'
import Link from 'next/link'
import { Heading } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { getOverview } from '@/server/admin/overview'
import { requireStaff } from '@/server/auth/guards'

export const metadata: Metadata = { title: 'Overview — Admin' }
export const dynamic = 'force-dynamic'

function Figure({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="flex flex-col rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5 hover:border-[var(--color-signal)]">
      <span className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{label}</span>
      <span className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--color-ink)]">{value}</span>
    </Link>
  )
}

export default async function AdminOverviewPage() {
  const staff = await requireStaff()
  const overview = await getOverview(staff.staffRole)
  const none = Object.keys(overview).length === 0

  return (
    <div>
      <Heading as="h1" size="title">
        Overview
      </Heading>
      <p className="mt-2 text-[var(--color-ink-soft)]">What needs attention, for your role. Every number is counted from the live records.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {overview.applicationsAwaitingReview !== undefined && (
          <Figure label="Applications awaiting a first look" value={overview.applicationsAwaitingReview} href="/admin/applications?status=submitted" />
        )}
        {overview.applicationsInProgress !== undefined && (
          <Figure label="Applications in progress" value={overview.applicationsInProgress} href="/admin/applications" />
        )}
        {overview.newEnquiries !== undefined && <Figure label="New enquiries" value={overview.newEnquiries} href="/admin/enquiries?status=new" />}
        {overview.activeMembers !== undefined && <Figure label="Active accounts" value={overview.activeMembers} href="/admin/members" />}
        {overview.inactiveMembers !== undefined && <Figure label="Deactivated accounts" value={overview.inactiveMembers} href="/admin/members?inactive=1" />}
      </div>

      {none && (
        <p className="mt-8 text-[var(--color-ink-soft)]">
          Your role works in the content console. Use <Link href="/admin" className="font-semibold text-[var(--color-signal)] underline">Full admin</Link> for programs, events, startups and mentors.
        </p>
      )}

      {overview.recentActions && (
        <section className="mt-12" aria-labelledby="recent">
          <div className="flex items-baseline justify-between">
            <Heading as="h2" size="heading" className="" >
              <span id="recent">Latest staff actions</span>
            </Heading>
            <Link href="/admin/audit" className="text-[length:var(--text-small)] font-semibold text-[var(--color-signal)] underline">
              Full audit trail
            </Link>
          </div>
          {overview.recentActions.length === 0 ? (
            <p className="mt-4 text-[var(--color-ink-muted)]">No staff actions have been recorded yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
              {overview.recentActions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[length:var(--text-small)]">
                  <span>
                    <strong>{a.action.replace(/_/g, ' ')}</strong> on {a.entityType} by {a.actorEmail}
                  </span>
                  <span className="text-[var(--color-ink-muted)]">{formatDate(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
