import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, Heading, Table } from '@/components/ui'
import type { Column } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { listApplicationsForReview } from '@/server/applications/review'
import { getContentClient } from '@/server/content/payload-client'

export const metadata: Metadata = { title: 'Applications — Admin' }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Not this time',
  waitlisted: 'Waitlisted',
}

type Row = Awaited<ReturnType<typeof listApplicationsForReview>>[number]

const COLUMNS: Column<Row>[] = [
  {
    header: 'Applicant',
    cell: (row) => (
      <Link href={`/admin/applications/${row.application.id}`} className="font-medium text-[var(--color-signal)]">
        {row.applicant.name ?? row.applicant.email}
      </Link>
    ),
  },
  { header: 'Program', cell: (row) => row.programTitle },
  {
    header: 'Submitted',
    cell: (row) => (row.application.submittedAt ? formatDate(row.application.submittedAt) : '—'),
  },
  { header: 'Status', cell: (row) => STATUS_LABELS[row.application.status] },
]

function Card({ row }: { row: Row }) {
  return (
    <div className="flex flex-col gap-1">
      <Link href={`/admin/applications/${row.application.id}`} className="font-medium text-[var(--color-signal)]">
        {row.applicant.name ?? row.applicant.email}
      </Link>
      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{row.programTitle}</p>
      <p className="mt-2 text-[length:var(--text-small)]">
        {STATUS_LABELS[row.application.status]}
        {row.application.submittedAt && ` · ${formatDate(row.application.submittedAt)}`}
      </p>
    </div>
  )
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; status?: string }>
}) {
  const params = await searchParams
  const payload = await getContentClient()
  const programs = await payload.find({ collection: 'programs', limit: 100, depth: 0, overrideAccess: false })

  const rows = await listApplicationsForReview({
    programId: params.program ? Number(params.program) : undefined,
    status: (params.status as never) || undefined,
  })

  return (
    <div>
      <Heading as="h1" size="title">
        Applications
      </Heading>

      <form className="mt-6 flex flex-wrap gap-4" method="get">
        <select name="program" defaultValue={params.program ?? ''} className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3">
          <option value="">All programs</option>
          {programs.docs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''} className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="h-11 rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-[length:var(--text-small)] text-white">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState heading="Nothing here yet" body="Applications matching this filter will appear here." size="compact" />
        </div>
      ) : (
        <Table className="mt-8" rows={rows} columns={COLUMNS} rowKey={(row) => row.application.id} renderCard={(row) => <Card row={row} />} />
      )}
    </div>
  )
}
