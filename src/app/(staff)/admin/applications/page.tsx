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

type Row = Awaited<ReturnType<typeof listApplicationsForReview>>['rows'][number]

const COLUMNS: Column<Row>[] = [
  {
    header: 'Applicant',
    cell: (row) => (
      // The row's primary action, and an 18px target until each row got a
      // name to render — a defect that only exists once there are rows.
      <Link
        href={`/admin/applications/${row.application.id}`}
        className="-my-3 flex min-h-11 items-center py-3 font-medium text-[var(--color-signal)]"
      >
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
      <Link
        href={`/admin/applications/${row.application.id}`}
        className="-my-2 flex min-h-11 items-center py-2 font-medium text-[var(--color-signal)]"
      >
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
  searchParams: Promise<{ program?: string; status?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const payload = await getContentClient()
  const programs = await payload.find({ collection: 'programs', limit: 100, depth: 0, overrideAccess: false })

  const { rows, page, total, pageCount } = await listApplicationsForReview({
    programId: params.program ? Number(params.program) : undefined,
    status: (params.status as never) || undefined,
    q: params.q?.trim() || undefined,
    page: params.page ? Number(params.page) : 1,
  })

  const pageHref = (next: number) => {
    const search = new URLSearchParams()
    if (params.program) search.set('program', params.program)
    if (params.status) search.set('status', params.status)
    if (params.q) search.set('q', params.q)
    search.set('page', String(next))
    return `/admin/applications?${search.toString()}`
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Applications
      </Heading>
      <p className="mt-2 text-[var(--color-ink-soft)]">
        {total} {total === 1 ? 'application' : 'applications'}
        {params.q ? ` matching “${params.q}”` : ''}
      </p>

      {/* Both selects had no accessible name — no label, no aria-label, and a
          first option ("All programs") that is a value rather than a name. axe
          reported it as a critical select-name violation; a screen reader
          announced two unlabelled combo boxes. The filter row is deliberately
          compact with no visible labels, so the name goes on the control. */}
      <form className="mt-6 flex flex-wrap gap-4" method="get">
        {/* Search was missing entirely: with no way to look someone up, the
            only way to find one application was to read the whole list. */}
        <input
          type="search"
          name="q"
          aria-label="Search by applicant"
          defaultValue={params.q ?? ''}
          placeholder="Name or email"
          className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3"
        />
        <select name="program" aria-label="Filter by program" defaultValue={params.program ?? ''} className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3">
          <option value="">All programs</option>
          {programs.docs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select name="status" aria-label="Filter by status" defaultValue={params.status ?? ''} className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3">
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
        <>
          <Table className="mt-8" rows={rows} columns={COLUMNS} rowKey={(row) => row.application.id} renderCard={(row) => <Card row={row} />} />

          {pageCount > 1 && (
            <nav aria-label="Pages" className="mt-8 flex items-center gap-4">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="flex h-11 items-center underline underline-offset-4">
                  Previous
                </Link>
              )}
              <span className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                Page {page} of {pageCount}
              </span>
              {page < pageCount && (
                <Link href={pageHref(page + 1)} className="flex h-11 items-center underline underline-offset-4">
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
