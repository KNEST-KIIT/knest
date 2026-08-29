import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/dates'
import { getApplicationForReview } from '@/server/applications/review'
import { nextStatuses } from '@/server/applications/transitions'
import { StatusForm } from './status-form'
import { Heading } from '@/components/ui'

export const metadata: Metadata = { title: 'Review application — Admin' }

export default async function AdminApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getApplicationForReview(id)
  if (!detail) notFound()

  const { application, applicant, program, answers, documents } = detail
  const answerMap = new Map(answers.map((a) => [a.questionId, a.value]))
  const documentMap = new Map(documents.map((d) => [d.questionId, d]))

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
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
                  <a
                    href={`/api/admin/applications/${application.id}/documents/${q.id}`}
                    className="mt-1 inline-block font-medium text-[var(--color-signal)]"
                  >
                    {documentMap.get(q.id)!.fileName}
                  </a>
                ) : (
                  <p className="mt-1">—</p>
                )
              ) : (
                <p className="mt-1 whitespace-pre-wrap">
                  {Array.isArray(answerMap.get(q.id))
                    ? (answerMap.get(q.id) as string[]).join(', ')
                    : (answerMap.get(q.id) as string) || '—'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <aside>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6">
          <Heading as="h2" size="heading">
            Status
          </Heading>
          <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            Currently: <strong>{application.status}</strong>
          </p>
          <div className="mt-4">
            <StatusForm applicationId={application.id} options={[...nextStatuses(application.status)]} />
          </div>
        </div>
      </aside>
    </div>
  )
}
