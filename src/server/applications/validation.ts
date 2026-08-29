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
      const values = (question.options ?? []).map((o) => o.label)
      const schema = z.string().refine((v) => values.includes(v), 'Pick one of the options.')
      return required ? schema : schema.optional().or(z.literal(''))
    }
    case 'multiselect': {
      const values = (question.options ?? []).map((o) => o.label)
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
