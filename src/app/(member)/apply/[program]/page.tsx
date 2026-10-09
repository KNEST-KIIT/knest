import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/server/auth/guards'
import { getApplicationProgramBySlug } from '@/server/applications/program-questions'
import { findApplicationForProgram, getOwnedApplicationDetail } from '@/server/applications/actions'
import { ApplicationForm } from './application-form'
import { StartApplication } from './start-application'

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
    const closed =
      program.applicationStatus !== 'open' ||
      (program.applicationDeadline !== null && new Date(program.applicationDeadline) < new Date())
    if (closed) redirect(`/programs/${slug}`)
    return <StartApplication programSlug={slug} programTitle={program.title} />
  }

  const detail = await getOwnedApplicationDetail(existing.id, user.id)
  if (!detail) redirect(`/programs/${slug}`)

  if (detail.application.status !== 'draft') {
    redirect('/dashboard/applications')
  }

  return (
    <ApplicationForm
      applicationId={detail.application.id}
      programTitle={program.title}
      questions={program.questions}
      initialAnswers={Object.fromEntries(detail.answers.map((a) => [a.questionId, a.value]))}
      initialDocuments={Object.fromEntries(detail.documents.map((d) => [d.questionId, d.fileName]))}
    />
  )
}
