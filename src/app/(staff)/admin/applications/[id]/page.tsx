import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { formatDate, formatEventTime } from '@/lib/dates'
import { getApplicationForReview } from '@/server/applications/review'
import { nextStatuses } from '@/server/applications/transitions'
import { StatusForm } from './status-form'
import { Heading } from '@/components/ui'
import Link from 'next/link'
import { formatApplicationAnswer } from '@/lib/application-progress'

export const metadata: Metadata = { title: 'Review application — Admin' }

export default async function AdminApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getApplicationForReview(id)
  if (!detail) notFound()

  const { application, applicant, program, answers, documents } = detail
  const answerMap = new Map(answers.map((a) => [a.questionId, a.value]))
  const documentMap = new Map(documents.map((d) => [d.questionId, d]))

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <Link href="/admin/applications" className="mb-6 inline-block text-sm font-semibold text-[var(--color-signal)]">← Back to applications</Link>
        <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">{program?.title}</p>
        <Heading as="h1" size="title">
          {applicant.name ?? applicant.email}
        </Heading>
        <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {applicant.email}
          {application.submittedAt && ` · Submitted ${formatDate(application.submittedAt)}`}
        </p>

        <div className="mt-8 flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {(program?.questions ?? []).map((q) => (
            <div key={q.id} className="py-4">
              <p className="text-[length:var(--text-small)] font-medium text-[var(--color-ink-muted)]">{q.label}</p>
              {q.fieldType === 'file' ? (
                documentMap.has(q.id) ? (
                  documentMap.get(q.id)!.scanStatus === 'clean' ? (
                    <a
                      href={`/api/admin/applications/${application.id}/documents/${q.id}`}
                      className="mt-1 inline-block break-words font-medium text-[var(--color-signal)]"
                    >
                      {documentMap.get(q.id)!.fileName}
                    </a>
                  ) : (
                    // Only a file that passed malware screening can be opened. A submitted application should hold nothing else.
                    <p className="mt-1 break-words">{documentMap.get(q.id)!.fileName} — not available: it did not pass the malware check ({documentMap.get(q.id)!.scanStatus.replaceAll('_', ' ')}).</p>
                  )
                ) : (
                  <p className="mt-1">—</p>
                )
              ) : (
                <p className="mt-1 whitespace-pre-wrap break-words">
                  {formatApplicationAnswer(answerMap.get(q.id), q.options)}
                </p>
              )}
            </div>
          ))}
        </div>
        <section className="mt-10" aria-labelledby="review-history">
          <Heading id="review-history" as="h2" size="heading">Review history</Heading>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Latest 30 updates. Internal notes are visible only to staff.</p>
          <ol className="mt-4 divide-y divide-[var(--color-line)]">
            {detail.history.map((entry) => <li key={entry.id} className="py-4"><p className="font-medium capitalize">{entry.status ? entry.status.replaceAll('_', ' ') : entry.action === 'application_document_viewed' ? 'Document downloaded' : entry.action.replaceAll('_', ' ')}</p><p className="mt-1 text-sm text-[var(--color-ink-muted)]">{formatEventTime(entry.createdAt)} · {entry.actorName ?? 'Account no longer available'}</p>{entry.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm">Internal note: {entry.note}</p>}</li>)}
          </ol>
        </section>
      </div>

      <aside>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6">
          <Heading as="h2" size="heading">
            Status
          </Heading>
          <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            Currently: <strong>{application.status.replaceAll('_', ' ')}</strong>
          </p>
          <div className="mt-4">
            <StatusForm applicationId={application.id} options={[...nextStatuses(application.status)]} />
          </div>
        </div>
      </aside>
    </div>
  )
}
