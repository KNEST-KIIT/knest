export const DEFAULT_MAX_TEXT_ANSWER = 500
export const DEFAULT_MAX_TEXTAREA_ANSWER = 5000

export type ApplicationQuestion = {
  id: string
  label: string
  helpText?: string | null
  fieldType: 'text' | 'textarea' | 'select' | 'multiselect' | 'url' | 'file'
  options?: { label: string; value: string }[] | null
  required?: boolean | null
  maxLength?: number | null
}

/**
 * Returns the effective maximum length for an answer.
 * If CMS maxLength is configured (> 0), it is respected.
 * If absent, hard defaults are enforced:
 *  - text: 500 characters
 *  - textarea: 5000 characters
 */
export function effectiveMaxLength(question: { fieldType: string; maxLength?: number | null }): number | undefined {
  if (question.maxLength != null && question.maxLength > 0) {
    return question.maxLength
  }
  if (question.fieldType === 'text') {
    return DEFAULT_MAX_TEXT_ANSWER
  }
  if (question.fieldType === 'textarea') {
    return DEFAULT_MAX_TEXTAREA_ANSWER
  }
  return undefined
}

