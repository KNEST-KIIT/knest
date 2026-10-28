import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/server/auth/guards'
import { getApplicationProgramBySlug } from '@/server/applications/program-questions'
import { findApplicationForProgram, getOwnedApplicationDetail } from '@/server/applications/actions'
import { ButtonLink, Heading } from '@/components/ui'
import { closedReason } from '@/server/applications/availability'
import { ApplicationForm } from './application-form'
import { StartApplication } from './start-application'
import { turnstileSiteKey } from '@/server/security/turnstile'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ program: string }>
}): Promise<Metadata> {
  const { program: slug } = await params
  const program = await getApplicationProgramBySlug(slug)
  return { title: program ? `Apply — ${program.title}` : 'Apply' }
}

export default async function ApplyPage({ params }: { params: Promise<{ program: string }> }) {
  const { program: slug } = await params
  const user = await requireUser(`/apply/${slug}`)

  const program = await getApplicationProgramBySlug(slug)
  if (!program) notFound()

  // Viewing this page never creates anything: a draft is made only when the
  // person presses Start (R-06).
  const existing = await findApplicationForProgram(user.id, program.id)
  if (!existing) {
    // Not open, or the deadline passed — send them back to the program page,
    // which explains why and offers "notify me" instead of a dead end here.
    if (closedReason(program)) redirect(`/programs/${slug}`)
    return <StartApplication programSlug={slug} programTitle={program.title} questions={program.questions} />
  }

  const detail = await getOwnedApplicationDetail(existing.id, user.id)
  if (!detail) redirect(`/programs/${slug}`)

  if (detail.application.status !== 'draft') {
    redirect(`/dashboard/applications/${detail.application.id}`)
  }

  // An existing draft on a program that has since closed: say so up front
  // instead of letting the person fill in every answer and fail at submit.
  const closed = closedReason(program)
  if (closed) {
    return (
      <section>
        <Heading as="h1" size="title">
          {program.title} is closed
        </Heading>
        <p role="status" className="mt-4 max-w-[60ch] text-[var(--color-ink-soft)]">
          {closed} Your draft is kept, but it can’t be submitted.
        </p>
        <div className="mt-8 flex gap-4">
          <ButtonLink href="/programs">See open programs</ButtonLink>
          <ButtonLink href="/dashboard/applications" variant="secondary">
            Your applications
          </ButtonLink>
        </div>
      </section>
    )
  }

  return (
    <ApplicationForm
      applicationId={detail.application.id}
      programTitle={program.title}
      questions={program.questions}
      initialAnswers={Object.fromEntries(detail.answers.map((a) => [a.questionId, a.value]))}
      initialDocuments={Object.fromEntries(detail.documents.map((d) => [d.questionId, { fileName: d.fileName, scanStatus: d.scanStatus, message: d.scanMessage }]))}
      turnstileSiteKey={turnstileSiteKey()}
    />
  )
}
