import { z } from 'zod'
import type { ApplicationQuestion } from './types'

/**
 * Builds a Zod schema for one question from its Payload definition. The
 * shape of "a valid answer" is defined entirely by CMS data — there is no
 * hardcoded application form to keep in sync with it (spec §18).
 */
export function schemaForQuestion(question: ApplicationQuestion): z.ZodTypeAny {
  const required = question.required !== false

  switch (question.fieldType) {
    case 'text':
    case 'textarea': {
      let schema = z.string().trim()
      if (question.maxLength) schema = schema.max(question.maxLength)
      return required ? schema.min(1, 'This one’s needed.') : schema.optional().or(z.literal(''))
    }
    case 'url': {
      const schema = z.string().trim().url('That doesn’t look like a URL.')
      return required ? schema : schema.optional().or(z.literal(''))
    }
    case 'select': {
      const values = (question.options ?? []).map((o) => o.value)
      const schema = z.string().refine((v) => values.includes(v), 'Pick one of the options.')
      return required ? schema : schema.optional().or(z.literal(''))
    }
    case 'multiselect': {
      const values = (question.options ?? []).map((o) => o.value)
      const schema = z.array(z.string().refine((v) => values.includes(v)))
      return required ? schema.min(1, 'Pick at least one.') : schema
    }
    case 'file':
      // Files are validated separately at upload time (MIME + size,
      // server-side) — an answer here is just confirmation one was attached.
      return required ? z.literal(true, { message: 'Attach a file to continue.' }) : z.boolean().optional()
  }
}

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export type SubmissionProblem = { questionId: string; label: string; message: string }

/**
 * Whether a draft is fit to submit, judged against the program's CURRENT question
 * set (KN-31). Submit used to check only that an answer row existed, so an answer
 * saved against an older question set (an option since removed, a tighter length
 * limit) was accepted. Stored values are re-validated with the same schema that
 * guards saving. Answers whose question no longer exists are ignored.
 *
 * Returns the first problem, in question order, or null.
 */
export function findSubmissionProblem(
  questions: ApplicationQuestion[],
  answers: { questionId: string; value: unknown }[],
  documentQuestionIds: Iterable<string>,
): SubmissionProblem | null {
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a.value]))
  const documented = new Set(documentQuestionIds)

  for (const question of questions) {
    const required = question.required !== false

    if (question.fieldType === 'file') {
      if (required && !documented.has(question.id)) {
        return { questionId: question.id, label: question.label, message: `“${question.label}” still needs an answer.` }
      }
      continue
    }

    if (!answerByQuestion.has(question.id)) {
      if (required) {
        return { questionId: question.id, label: question.label, message: `“${question.label}” still needs an answer.` }
      }
      continue
    }

    const parsed = schemaForQuestion(question).safeParse(answerByQuestion.get(question.id))
    if (!parsed.success) {
      const why = parsed.error.issues[0]?.message ?? 'Check your answer.'
      return { questionId: question.id, label: question.label, message: `“${question.label}” needs another look: ${why}` }
    }
  }
  return null
}
