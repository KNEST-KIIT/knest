import { describe, expect, it } from 'vitest'
import { applicationResumeIndex, formatApplicationAnswer } from './application-progress'
import type { ApplicationQuestion } from '@/server/applications/types'

const questions: ApplicationQuestion[] = [
  { id: 'idea', label: 'Your idea', fieldType: 'text' },
  { id: 'site', label: 'Website', fieldType: 'url', required: false },
  { id: 'pitch', label: 'Pitch', fieldType: 'file', required: true },
]

describe('application recovery', () => {
  it('does not strand a question-free application on section one of zero', () => {
    expect(applicationResumeIndex([], {}, {})).toBe(-1)
  })
  it('resumes after saved answers, including an intentionally skipped optional answer', () => {
    expect(applicationResumeIndex(questions, { idea: 'Study planner', site: '' }, {})).toBe(2)
    expect(applicationResumeIndex(questions, { idea: 'Study planner' }, {})).toBe(1)
  })
  it('opens review when saved answers and required documents are present', () => {
    expect(applicationResumeIndex(questions, { idea: 'Study planner', site: '' }, { pitch: 'pitch.pdf' })).toBe(-1)
  })
  it('uses the visible choice label in review and handles missing optional values', () => {
    expect(formatApplicationAnswer(['edtech'], [{ value: 'edtech', label: 'Education' }])).toBe('Education')
    expect(formatApplicationAnswer('')).toBe('Not provided')
  })
})
