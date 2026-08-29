import { getContentClient } from '@/server/content/payload-client'
import type { ApplicationQuestion } from './types'

export type ApplicationProgram = {
  id: number
  title: string
  slug: string
  applicationStatus: 'open' | 'opening_soon' | 'closed' | 'in_progress'
  applicationDeadline: string | null
  questions: ApplicationQuestion[]
}

/** The single place that reads a program's question set — used by both the applicant form and server-side submit validation, so they can never drift apart. */
export async function getApplicationProgram(programId: number): Promise<ApplicationProgram | null> {
  const payload = await getContentClient()
  const program = await payload.findByID({
    collection: 'programs',
    id: programId,
    depth: 0,
    overrideAccess: false,
  })
  if (!program) return null

  return {
    id: program.id,
    title: program.title,
    slug: program.slug,
    applicationStatus: program.applicationStatus,
    applicationDeadline: program.applicationDeadline ?? null,
    questions: (program.applicationQuestions ?? []).map((q) => ({
      id: q.id!,
      label: q.label,
      helpText: q.helpText,
      fieldType: q.fieldType,
      options: q.options,
      required: q.required,
      maxLength: q.maxLength,
    })),
  }
}

export async function getApplicationProgramBySlug(slug: string): Promise<ApplicationProgram | null> {
  const payload = await getContentClient()
  const result = await payload.find({
    collection: 'programs',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    overrideAccess: false,
  })
  const program = result.docs[0]
  if (!program) return null
  return getApplicationProgram(program.id)
}
