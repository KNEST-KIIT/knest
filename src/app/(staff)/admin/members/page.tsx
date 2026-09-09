import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, Heading, Table } from '@/components/ui'
import type { Column } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { levelDefinition } from '@/server/founders/levels'
import { listMembers } from '@/server/members/directory'

export const metadata: Metadata = { title: 'Members — Admin' }

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  founder: 'Founder',
  mentor: 'Mentor',
  investor: 'Investor',
  alumni: 'Alumni',
  partner: 'Partner',
  other: 'Other',
}

type Row = Awaited<ReturnType<typeof listMembers>>['rows'][number]

const COLUMNS: Column<Row>[] = [
  {
    header: 'Member',
    cell: (row) => (
      <Link
        href={`/admin/members/${row.id}`}
        className="-my-3 flex min-h-11 items-center py-3 font-medium text-[var(--color-signal)]"
      >
        {row.name ?? row.email}
      </Link>
    ),
  },
  { header: 'Role', cell: (row) => ROLE_LABELS[row.platformRole] ?? row.platformRole },
  {
    header: 'Level',
    cell: (row) => `${row.founderLevel} · ${levelDefinition(row.founderLevel).label}`,
  },
  {
    // Two different things, shown side by side on purpose: what they said and
    // what KNEST granted. They are not meant to match.
    header: 'Says',
    cell: (row) => row.journeyStage ?? '—',
  },
  { header: 'Staff', cell: (row) => row.staffRole ?? '—' },
  { header: 'Joined', cell: (row) => formatDate(row.createdAt) },
]

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; platformRole?: string; level?: string; page?: string }>
}) {
  const params = await searchParams
  const { rows, page, total, pageCount } = await listMembers({
    q: params.q?.trim() || undefined,
    platformRole: params.platformRole || undefined,
    level: params.level ? Number(params.level) : undefined,
    page: params.page ? Number(params.page) : 1,
  })

  const qs = (next: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (params.platformRole) search.set('platformRole', params.platformRole)
    if (params.level) search.set('level', params.level)
    search.set('page', String(next))
    return `/admin/members?${search.toString()}`
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Members
      </Heading>
      <p className="mt-2 text-[var(--color-ink-soft)]">
        {total} {total === 1 ? 'account' : 'accounts'}
      </p>

      {/* A GET form, so the filter state lives in the URL and is shareable —
          the pattern FilterBar established, without needing a client component
          for a search box. */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[length:var(--text-small)] font-medium">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Name or email"
            className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[length:var(--text-small)] font-medium">Role</span>
          <select
            name="platformRole"
            defaultValue={params.platformRole ?? ''}
            className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3"
          >
            <option value="">Any role</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[length:var(--text-small)] font-medium">Level</span>
          <select
            name="level"
            defaultValue={params.level ?? ''}
            className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3"
          >
            <option value="">Any level</option>
            {[1, 2, 3, 4, 5, 6, 7].map((level) => (
              <option key={level} value={level}>
                {level} · {levelDefinition(level).label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-11 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-[length:var(--text-small)] text-white"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState heading="No one matches that" body="Try a different search or role." size="compact" />
        </div>
      ) : (
        <>
          <div className="mt-8">
            <Table
              rows={rows}
              columns={COLUMNS}
              rowKey={(row) => row.id}
              renderCard={(row) => (
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/admin/members/${row.id}`}
                    className="-my-2 flex min-h-11 items-center py-2 font-medium text-[var(--color-signal)]"
                  >
                    {row.name ?? row.email}
                  </Link>
                  <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {ROLE_LABELS[row.platformRole] ?? row.platformRole} · Level {row.founderLevel}
                    {row.staffRole ? ` · ${row.staffRole}` : ''}
                  </p>
                </div>
              )}
            />
          </div>

          {pageCount > 1 && (
            <nav aria-label="Pages" className="mt-8 flex items-center gap-4">
              {page > 1 && (
                <Link href={qs(page - 1)} className="flex h-11 items-center underline underline-offset-4">
                  Previous
                </Link>
              )}
              <span className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                Page {page} of {pageCount}
              </span>
              {page < pageCount && (
                <Link href={qs(page + 1)} className="flex h-11 items-center underline underline-offset-4">
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  )
}
