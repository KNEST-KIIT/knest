import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ButtonLink, Heading, Section } from '@/components/ui'
import { formatDate, formatEventTime } from '@/lib/dates'
import { formatApplicationAnswer } from '@/lib/application-progress'
import { getOwnedApplicationDetail } from '@/server/applications/actions'
import { requireUser } from '@/server/auth/guards'
import { ApplicationStatusBadge } from '../status-badge'
import { RefreshStatus } from './refresh-status'

export const metadata: Metadata = { title: 'Your application' }

export default async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser(`/dashboard/applications/${id}`)
  const detail = await getOwnedApplicationDetail(id, user.id)
  if (!detail) notFound()
  const answers = new Map(detail.answers.map((answer) => [answer.questionId, answer.value]))
  const documents = new Map(detail.documents.map((document) => [document.questionId, document.fileName]))
  return (
    <Section>
      <ButtonLink href="/dashboard/applications" variant="secondary" size="sm">← Your applications</ButtonLink>
      <Heading as="h1" size="title" className="mt-8">{detail.program?.title ?? 'Your application'}</Heading>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Reference: {detail.application.id}</p>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{detail.application.submittedAt ? `Submitted ${formatDate(detail.application.submittedAt)}` : 'Saved draft'} · Last updated {formatEventTime(detail.application.updatedAt)}</p>
      <div className="mt-6"><ApplicationStatusBadge status={detail.application.status} /></div>
      <div className="mt-4"><RefreshStatus /></div>
      <p className="mt-4 max-w-prose text-[var(--color-ink-soft)]">{detail.application.status === 'draft' ? 'Your draft is private until you submit it.' : 'This is your saved submission. Status changes appear here and in your notifications. The team will contact you if they need anything else.'}</p>
      {detail.application.status === 'draft' && <ButtonLink href={`/apply/${detail.program?.slug ?? ''}`} className="mt-6">Continue application</ButtonLink>}
      <Heading as="h2" size="heading" className="mt-10">{detail.application.status === 'draft' ? 'Saved answers' : 'What you submitted'}</Heading>
      <dl className="mt-4 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
        {(detail.program?.questions ?? []).map((question) => <div key={question.id} className="py-4"><dt className="font-medium">{question.label}</dt><dd className="mt-2 whitespace-pre-wrap break-words">{question.fieldType === 'file' && documents.has(question.id) ? <a href={`/api/applications/${id}/documents/${question.id}`} className="text-[var(--color-signal)] underline">{documents.get(question.id)} — download</a> : question.fieldType === 'file' ? 'Not provided' : formatApplicationAnswer(answers.get(question.id), question.options)}</dd></div>)}
      </dl>
    </Section>
  )
}
