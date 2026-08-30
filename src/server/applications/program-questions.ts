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
  return program ? mapProgram(program) : null
}

/**
 * Maps directly off the slug-fetched document instead of discarding it and
 * calling getApplicationProgram(id) — that was a fully redundant second
 * round trip for a document already in hand (§5.3).
 */
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
  return program ? mapProgram(program) : null
}

function mapProgram(program: {
  id: number
  title: string
  slug: string
  applicationStatus: 'open' | 'opening_soon' | 'closed' | 'in_progress'
  applicationDeadline?: string | null
  applicationQuestions?:
    | {
        id?: string | null
        label: string
        helpText?: string | null
        fieldType: ApplicationQuestion['fieldType']
        options?: { label: string }[] | null
        required?: boolean | null
        maxLength?: number | null
      }[]
    | null
}): ApplicationProgram {
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

/** Batched title/slug lookup for application list pages (§5.2) — one query for N programs instead of N. */
export async function getProgramTitlesByIds(
  programIds: number[],
): Promise<Map<number, { title: string; slug: string }>> {
  const map = new Map<number, { title: string; slug: string }>()
  if (programIds.length === 0) return map

  const payload = await getContentClient()
  const result = await payload.find({
    collection: 'programs',
    where: { id: { in: programIds } },
    depth: 0,
    limit: programIds.length,
    overrideAccess: false,
  })

  for (const program of result.docs) {
    map.set(program.id, { title: program.title, slug: program.slug })
  }
  return map
}
