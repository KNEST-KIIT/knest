import { describe, expect, it } from 'vitest'
import type { ApplicationQuestion } from './types'
import { findSubmissionProblem } from './validation'

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
