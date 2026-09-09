import type { Metadata } from 'next'
import Link from 'next/link'
import { Button, EmptyState, Heading, Select, Table } from '@/components/ui'
import type { Column } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { REVIEW_QUEUE_EMPTY } from '@/lib/empty-state-copy'
import { resultSummary } from '@/lib/result-summary'
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

  const hasFilters = Boolean(params.program || params.status)
  const summary = resultSummary(rows.length, 'application', {
    hasFilters,
    emptyNoFilters: 'No applications yet.',
  })

  return (
    <div>
      <Heading as="h1" size="title">
        Applications
      </Heading>
      <p className="mt-3 max-w-[62ch] text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
        Every submitted application, newest first. Open one to read the answers, see the documents and
        move it through review — each status change is recorded against your account and the applicant
        is told what happened.
      </p>

      {/* Unlike the public listings, this filter bar always renders: a review
          queue is a work surface for people who know the vocabulary, it grows
          fast, and a reviewer needs the same controls in the same place every
          day — including on the morning the queue happens to be empty. */}
      <form className="mt-8 flex flex-wrap items-end gap-4" method="get">
        <label className="flex flex-col gap-1.5">
          <span className="text-[length:var(--text-small)] font-medium">Program</span>
          <Select name="program" defaultValue={params.program ?? ''} className="min-w-[12rem]">
            <option value="">All programs</option>
            {programs.docs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[length:var(--text-small)] font-medium">Status</span>
          <Select name="status" defaultValue={params.status ?? ''} className="min-w-[12rem]">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="secondary" size="lg">
          Apply
        </Button>
        {hasFilters && (
          <a
            href="/admin/applications"
            className="h-12 self-end text-[length:var(--text-small)] text-[var(--color-ink-muted)] underline underline-offset-2"
          >
            Clear
          </a>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            {...(hasFilters
              ? REVIEW_QUEUE_EMPTY
              : {
                  heading: 'No applications yet.',
                  body: 'Once a program opens and someone submits, their application lands here for review.',
                })}
            size="compact"
          />
        </div>
      ) : (
        <>
          <p className="mt-6 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{summary}</p>
          <Table className="mt-4" rows={rows} columns={COLUMNS} rowKey={(row) => row.application.id} renderCard={(row) => <Card row={row} />} />
        </>
      )}
    </div>
  )
}
