import type { ApplicationQuestion } from '@/server/applications/types'

/** Resume at the first unanswered question; an entirely saved draft opens review. */
export function applicationResumeIndex(questions: ApplicationQuestion[], answers: Record<string, unknown>, documents: Record<string, string>): number {
  return questions.findIndex((question) => question.fieldType === 'file'
    ? question.required !== false && !documents[question.id]
    : !Object.hasOwn(answers, question.id))
}

export function formatApplicationAnswer(raw: unknown, options?: { label: string; value: string }[] | null): string {
  const labelFor = (value: string) => options?.find((option) => option.value === value)?.label ?? value
  if (Array.isArray(raw)) return raw.length ? raw.map((value) => labelFor(String(value))).join(', ') : 'Not provided'
  return typeof raw === 'string' && raw ? labelFor(raw) : 'Not provided'
}
