import type { Metadata } from 'next'
import { EmptyState, Heading } from '@/components/ui'
import { Pagination } from '@/components/ui/pagination'
import { formatDate } from '@/lib/dates'
import { pageInfo, parsePage } from '@/lib/pagination'
import { requireAdminArea } from '@/server/auth/guards'
import { listMembers, MEMBERS_PAGE_SIZE } from '@/server/members/queries'
import { MemberActions } from './member-actions'

export const metadata: Metadata = { title: 'Members — Admin' }
export const dynamic = 'force-dynamic'

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; staff?: string; inactive?: string; page?: string }> }) {
  const me = await requireAdminArea('users')
  const params = await searchParams
  const result = await listMembers({ q: params.q, staffOnly: params.staff === '1', inactiveOnly: params.inactive === '1', page: parsePage(params.page) })
  const info = pageInfo(result.total, result.page, MEMBERS_PAGE_SIZE)

  const hrefFor = (page: number) => {
    const next = new URLSearchParams()
    if (params.q) next.set('q', params.q)
    if (params.staff === '1') next.set('staff', '1')
    if (params.inactive === '1') next.set('inactive', '1')
    if (page > 1) next.set('page', String(page))
    return `/admin/members${next.toString() ? `?${next}` : ''}`
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Members
      </Heading>
      <p className="mt-2 text-[var(--color-ink-soft)]">Find an account, deactivate or reactivate it, or change a staff role. Each change ends that person’s sessions and is recorded in the audit trail.</p>

      <form method="get" role="search" aria-label="Find members" className="mt-6 flex flex-wrap items-center gap-4">
        <label className="sr-only" htmlFor="q">
          Name or email
        </label>
        <input id="q" name="q" type="search" defaultValue={params.q ?? ''} placeholder="Name or email" className="h-11 min-w-[14rem] rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3" />
        <label className="flex items-center gap-2 text-[length:var(--text-small)]">
          <input type="checkbox" name="staff" value="1" defaultChecked={params.staff === '1'} /> Staff only
        </label>
        <label className="flex items-center gap-2 text-[length:var(--text-small)]">
          <input type="checkbox" name="inactive" value="1" defaultChecked={params.inactive === '1'} /> Deactivated only
        </label>
        <button type="submit" className="h-11 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-[length:var(--text-small)] text-white">
          Search
        </button>
      </form>

      {result.rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState heading="No accounts match" body="Try a different name or email." size="compact" />
        </div>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-4">
            {result.rows.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-5">
                <div>
                  <p className="font-semibold">
                    {m.name ?? '(no name)'} {!m.isActive && <span className="ml-2 rounded bg-[var(--color-critical)] px-2 py-0.5 text-xs font-bold uppercase text-white">Deactivated</span>}
                  </p>
                  <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {m.email} · {m.platformRole}
                    {m.staffRole ? ` · staff: ${m.staffRole.replace(/_/g, ' ')}` : ''} · joined {formatDate(m.createdAt)}
                    {m.emailVerified ? '' : ' · email not verified'}
                  </p>
                </div>
                <MemberActions id={m.id} isActive={m.isActive} staffRole={m.staffRole} isSelf={m.id === me.id} />
              </li>
            ))}
          </ul>
          <Pagination info={info} hrefFor={hrefFor} />
        </>
      )}
    </div>
  )
}
