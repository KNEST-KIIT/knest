import { describe, expect, it } from 'vitest'
import type { ApplicationQuestion } from './types'
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  DEFAULT_MAX_TEXT_ANSWER,
  DEFAULT_MAX_TEXTAREA_ANSWER,
  effectiveMaxLength,
  findSubmissionProblem,
  schemaForQuestion,
  staffStatusChangeSchema,
} from './validation'

const q = (over: Partial<ApplicationQuestion> & Pick<ApplicationQuestion, 'id' | 'fieldType'>): ApplicationQuestion => ({
  label: `Question ${over.id}`,
  required: true,
  ...over,
})
const QUESTIONS: ApplicationQuestion[] = [
  q({ id: 'idea', fieldType: 'textarea', maxLength: 50 }),
  q({ id: 'stage', fieldType: 'select', options: [{ label: 'Idea', value: 'idea' }, { label: 'MVP', value: 'mvp' }] }),
  q({ id: 'areas', fieldType: 'multiselect', options: [{ label: 'AI', value: 'ai' }, { label: 'Health', value: 'health' }] }),
  q({ id: 'site', fieldType: 'url', required: false }),
  q({ id: 'deck', fieldType: 'file' }),
]

const GOOD = [
  { questionId: 'idea', value: 'A short idea' },
  { questionId: 'stage', value: 'idea' },
  { questionId: 'areas', value: ['ai'] },
]

describe('findSubmissionProblem (KN-31)', () => {
  it('accepts a complete, valid draft', () => {
    expect(findSubmissionProblem(QUESTIONS, GOOD, ['deck'])).toBeNull()
  })

  it('reports a missing required answer, in question order', () => {
    const p = findSubmissionProblem(QUESTIONS, GOOD.slice(1), ['deck'])
    expect(p?.questionId).toBe('idea')
    expect(p?.message).toMatch(/still needs an answer/)
  })

  it('reports a missing required file', () => {
    expect(findSubmissionProblem(QUESTIONS, GOOD, [])?.questionId).toBe('deck')
  })

  it('does not insist on an optional question', () => {
    expect(findSubmissionProblem(QUESTIONS, GOOD, ['deck'])).toBeNull()
  })

  it('REJECTS a stored answer that no longer satisfies the current question (the bug: presence was enough)', () => {
    // saved when the limit was higher
    const tooLong = [{ questionId: 'idea', value: 'x'.repeat(80) }, ...GOOD.slice(1)]
    expect(findSubmissionProblem(QUESTIONS, tooLong, ['deck'])?.questionId).toBe('idea')

    // an option that staff have since removed
    const removed = [GOOD[0]!, { questionId: 'stage', value: 'scaling' }, GOOD[2]!]
    expect(findSubmissionProblem(QUESTIONS, removed, ['deck'])?.questionId).toBe('stage')

    // a multiselect that now contains an option that does not exist
    const badMulti = [GOOD[0]!, GOOD[1]!, { questionId: 'areas', value: ['ai', 'space'] }]
    expect(findSubmissionProblem(QUESTIONS, badMulti, ['deck'])?.questionId).toBe('areas')
  })

  it('validates an optional answer that WAS given', () => {
    const p = findSubmissionProblem(QUESTIONS, [...GOOD, { questionId: 'site', value: 'not a url' }], ['deck'])
    expect(p?.questionId).toBe('site')
  })

  it('rejects wrong types rather than coercing them', () => {
    for (const value of [null, 42, {}, ['x'], true]) {
      const p = findSubmissionProblem(QUESTIONS, [{ questionId: 'idea', value }, ...GOOD.slice(1)], ['deck'])
      expect(p?.questionId, JSON.stringify(value)).toBe('idea')
    }
  })

  it('ignores answers to questions that no longer exist', () => {
    expect(findSubmissionProblem(QUESTIONS, [...GOOD, { questionId: 'deleted', value: 'anything' }], ['deck'])).toBeNull()
  })

  it('an empty question set is submittable', () => {
    expect(findSubmissionProblem([], [], [])).toBeNull()
  })
})

describe('upload format boundary', () => {
  it('allows inspectable current formats but refuses ambiguous legacy OLE Office files', () => {
    expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('application/pdf')
    expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    expect(ALLOWED_UPLOAD_MIME_TYPES).not.toContain('application/msword')
    expect(ALLOWED_UPLOAD_MIME_TYPES).not.toContain('application/vnd.ms-powerpoint')
  })
})

describe('staffStatusChangeSchema', () => {
  it('accepts permitted staff statuses with optional note', () => {
    for (const status of ['under_review', 'shortlisted', 'interview', 'accepted', 'rejected', 'waitlisted'] as const) {
      const res = staffStatusChangeSchema.safeParse({ status, note: 'Good application' })
      expect(res.success).toBe(true)
    }
  })

  it('prohibits draft and submitted in staff status changes', () => {
    expect(staffStatusChangeSchema.safeParse({ status: 'draft' }).success).toBe(false)
    expect(staffStatusChangeSchema.safeParse({ status: 'submitted' }).success).toBe(false)
  })

  it('rejects arbitrary unknown statuses', () => {
    expect(staffStatusChangeSchema.safeParse({ status: 'approved' }).success).toBe(false)
    expect(staffStatusChangeSchema.safeParse({ status: 'cancelled' }).success).toBe(false)
    expect(staffStatusChangeSchema.safeParse({}).success).toBe(false)
  })

  it('enforces maximum note length of 2000 characters', () => {
    expect(staffStatusChangeSchema.safeParse({ status: 'under_review', note: 'x'.repeat(2000) }).success).toBe(true)
    expect(staffStatusChangeSchema.safeParse({ status: 'under_review', note: 'x'.repeat(2001) }).success).toBe(false)
  })
})

describe('effectiveMaxLength and default answer limits', () => {
  it('applies DEFAULT_MAX_TEXT_ANSWER (500) when CMS maxLength is absent for text', () => {
    const question = q({ id: 'title', fieldType: 'text' })
    expect(effectiveMaxLength(question)).toBe(DEFAULT_MAX_TEXT_ANSWER)
    expect(DEFAULT_MAX_TEXT_ANSWER).toBe(500)

    const schema = schemaForQuestion(question)
    expect(schema.safeParse('x'.repeat(500)).success).toBe(true)
    expect(schema.safeParse('x'.repeat(501)).success).toBe(false)
  })

  it('applies DEFAULT_MAX_TEXTAREA_ANSWER (5000) when CMS maxLength is absent for textarea', () => {
    const question = q({ id: 'essay', fieldType: 'textarea' })
    expect(effectiveMaxLength(question)).toBe(DEFAULT_MAX_TEXTAREA_ANSWER)
    expect(DEFAULT_MAX_TEXTAREA_ANSWER).toBe(5000)

    const schema = schemaForQuestion(question)
    expect(schema.safeParse('x'.repeat(5000)).success).toBe(true)
    expect(schema.safeParse('x'.repeat(5001)).success).toBe(false)
  })

  it('respects explicit CMS maxLength over defaults', () => {
    const customText = q({ id: 'headline', fieldType: 'text', maxLength: 100 })
    expect(effectiveMaxLength(customText)).toBe(100)
    const schemaText = schemaForQuestion(customText)
    expect(schemaText.safeParse('x'.repeat(100)).success).toBe(true)
    expect(schemaText.safeParse('x'.repeat(101)).success).toBe(false)

    const customTextarea = q({ id: 'pitch', fieldType: 'textarea', maxLength: 1500 })
    expect(effectiveMaxLength(customTextarea)).toBe(1500)
    const schemaArea = schemaForQuestion(customTextarea)
    expect(schemaArea.safeParse('x'.repeat(1500)).success).toBe(true)
    expect(schemaArea.safeParse('x'.repeat(1501)).success).toBe(false)
  })

  it('does not enforce length limits on non-text fields without maxLength', () => {
    const urlQuestion = q({ id: 'site', fieldType: 'url' })
    expect(effectiveMaxLength(urlQuestion)).toBeUndefined()
  })
})


