import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, Heading, StatusBadge, Table } from '@/components/ui'
import type { Column } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { LEVEL_REQUEST_STATUS } from '@/lib/status-config'
import { levelDefinition } from '@/server/founders/levels'
import { listLevelRequestsForReview } from '@/server/founders/review'

export const metadata: Metadata = { title: 'Level requests — Admin' }

type Row = Awaited<ReturnType<typeof listLevelRequestsForReview>>[number]

const COLUMNS: Column<Row>[] = [
  {
    header: 'Founder',
    cell: (row) => (
      <Link
        href={`/admin/levels/${row.id}`}
        className="-my-3 flex min-h-11 items-center py-3 font-medium text-[var(--color-signal)]"
      >
        {row.user?.name ?? row.user?.email ?? 'Unknown'}
      </Link>
    ),
  },
  {
    header: 'Asking for',
    cell: (row) => `${row.requestedLevel} · ${levelDefinition(row.requestedLevel).label}`,
  },
  { header: 'Asked', cell: (row) => formatDate(row.createdAt) },
  {
    header: 'Status',
    cell: (row) => <StatusBadge status={row.status} config={LEVEL_REQUEST_STATUS} />,
  },
]

export default async function LevelsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const rows = await listLevelRequestsForReview({ status: params.status })

  return (
    <div>
      <Heading as="h1" size="title">
        Level requests
      </Heading>
      <p className="mt-2 max-w-[68ch] text-[var(--color-ink-soft)]">
        A founder&rsquo;s journey stage is what they told us. Their level is what KNEST has
        verified. This is where the second one gets decided.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[length:var(--text-small)] font-medium">Status</span>
          <select
            name="status"
            aria-label="Filter by status"
            defaultValue={params.status ?? ''}
            className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3"
          >
            <option value="">All statuses</option>
            {Object.entries(LEVEL_REQUEST_STATUS).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
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
          <EmptyState
            heading="Nothing waiting"
            body="Level requests will appear here when founders ask to move up."
            size="compact"
          />
        </div>
      ) : (
        <div className="mt-8">
          <Table
            rows={rows}
            columns={COLUMNS}
            rowKey={(row) => row.id}
            renderCard={(row) => (
              <div className="flex flex-col gap-1">
                <Link
                  href={`/admin/levels/${row.id}`}
                  className="-my-2 flex min-h-11 items-center py-2 font-medium text-[var(--color-signal)]"
                >
                  {row.user?.name ?? row.user?.email ?? 'Unknown'}
                </Link>
                <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  Level {row.requestedLevel} · {formatDate(row.createdAt)}
                </p>
                <StatusBadge status={row.status} config={LEVEL_REQUEST_STATUS} />
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}
