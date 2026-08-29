import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState } from '@/components/ui'
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
      <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-title)] font-extrabold uppercase">
        Applications
      </h1>

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
        <div className="mt-8 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white">
          <table className="w-full text-left text-[length:var(--text-small)]">
            <thead className="border-b border-[var(--color-line)] text-[var(--color-ink-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ application, applicant, programTitle }) => (
                <tr key={application.id} className="border-b border-[var(--color-line)] last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/applications/${application.id}`} className="font-medium text-[var(--color-signal)]">
                      {applicant.name ?? applicant.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{programTitle}</td>
                  <td className="px-4 py-3">
                    {application.submittedAt ? formatDate(application.submittedAt) : '—'}
                  </td>
                  <td className="px-4 py-3">{STATUS_LABELS[application.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
