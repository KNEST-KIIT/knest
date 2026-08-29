import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/server/auth/guards'
import { getApplicationProgramBySlug } from '@/server/applications/program-questions'
import { getOwnedApplicationDetail, startApplication } from '@/server/applications/actions'
import { ApplicationForm } from './application-form'

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

  const result = await startApplication(slug)
  if (!result.ok) {
    // Applications aren't open, or the deadline passed — send them back to
    // the program page, which explains why and offers "notify me" instead
    // of a dead end here.
    redirect(`/programs/${slug}`)
  }

  const detail = await getOwnedApplicationDetail(result.applicationId, user.id)
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
