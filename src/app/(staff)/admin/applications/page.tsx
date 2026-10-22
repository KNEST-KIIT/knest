import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, Heading, Table } from '@/components/ui'
import type { Column } from '@/components/ui'
import { Pagination } from '@/components/ui/pagination'
import { formatDate } from '@/lib/dates'
import { pageInfo, parsePage } from '@/lib/pagination'
import { listApplicationsForReview } from '@/server/applications/review'
import { REVIEW_PAGE_SIZE, type ReviewFilterStatus } from '@/server/applications/review-constants'
import { getContentClient } from '@/server/content/payload-client'

export const metadata: Metadata = { title: 'Applications — Admin' }
export const dynamic = 'force-dynamic'

// "Draft" is deliberately absent: a draft is the applicant's own unfinished work, not for staff.
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Not this time',
  waitlisted: 'Waitlisted',
}

type Row = Awaited<ReturnType<typeof listApplicationsForReview>>['rows'][number]

const COLUMNS: Column<Row>[] = [
  {
    header: 'Applicant',
    cell: (row) => (
      <Link href={`/admin/applications/${row.application.id}`} className="font-medium text-[var(--color-signal)]">
        {row.applicant.name ?? row.applicant.email}
      </Link>
    ),
  },
  { header: 'Email', cell: (row) => row.applicant.email },
  { header: 'Program', cell: (row) => row.programTitle },
  { header: 'Submitted', cell: (row) => (row.application.submittedAt ? formatDate(row.application.submittedAt) : '—') },
  { header: 'Status', cell: (row) => STATUS_LABELS[row.application.status] ?? row.application.status },
]

function Card({ row }: { row: Row }) {
  return (
    <div className="flex flex-col gap-1">
      <Link href={`/admin/applications/${row.application.id}`} className="font-medium text-[var(--color-signal)]">
        {row.applicant.name ?? row.applicant.email}
      </Link>
      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{row.programTitle}</p>
      <p className="mt-2 text-[length:var(--text-small)]">
        {STATUS_LABELS[row.application.status] ?? row.application.status}
        {row.application.submittedAt && ` · ${formatDate(row.application.submittedAt)}`}
      </p>
    </div>
  )
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; status?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const payload = await getContentClient()
  const programs = await payload.find({ collection: 'programs', limit: 100, depth: 0, overrideAccess: false })

  const status: ReviewFilterStatus | undefined = params.status === 'in_progress' ? 'in_progress'
    : params.status && Object.hasOwn(STATUS_LABELS, params.status) ? params.status as ReviewFilterStatus : undefined
  const result = await listApplicationsForReview({
    programId: params.program ? Number(params.program) || undefined : undefined,
    status,
    q: params.q,
    page: parsePage(params.page),
  })
  const info = pageInfo(result.total, result.page, REVIEW_PAGE_SIZE)

  const hrefFor = (page: number) => {
    const next = new URLSearchParams()
    if (params.program) next.set('program', params.program)
    if (params.status) next.set('status', params.status)
    if (params.q) next.set('q', params.q)
    if (page > 1) next.set('page', String(page))
    const qs = next.toString()
    return `/admin/applications${qs ? `?${qs}` : ''}`
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Applications
      </Heading>
      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{result.total} {result.total === 1 ? 'application' : 'applications'}{params.q || params.program || params.status ? ' match these filters' : ' in the review queue'}. Student drafts stay private until submission.</p>

      <form className="mt-6 flex flex-wrap gap-4" method="get" role="search" aria-label="Filter applications">
        <label className="sr-only" htmlFor="q">
          Search by applicant name or email
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={params.q ?? ''}
          placeholder="Name or email"
          className="h-11 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 sm:w-auto sm:min-w-[14rem]"
        />
        <label className="sr-only" htmlFor="program">
          Program
        </label>
        <select id="program" name="program" defaultValue={params.program ?? ''} className="h-11 max-w-full rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3">
          <option value="">All programs</option>
          {programs.docs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="status">
          Status
        </label>
        <select id="status" name="status" defaultValue={params.status ?? ''} className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3">
          <option value="">All statuses</option>
          <option value="in_progress">All in-progress applications</option>
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

      {result.rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState heading={params.q || params.program || params.status ? 'No applications match these filters' : 'No submitted applications yet'} body="Submitted applications appear here for the review team. Drafts are not shown." size="compact" />
          {(params.q || params.program || params.status) && <Link href="/admin/applications" className="mt-4 inline-block font-semibold text-[var(--color-signal)] underline">Clear filters</Link>}
        </div>
      ) : (
        <>
          <Table className="mt-8" rows={result.rows} columns={COLUMNS} rowKey={(row) => row.application.id} renderCard={(row) => <Card row={row} />} />
          <Pagination info={info} hrefFor={hrefFor} />
        </>
      )}
    </div>
  )
}
