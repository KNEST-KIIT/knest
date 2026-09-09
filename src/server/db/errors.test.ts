import { describe, expect, it } from 'vitest'
import {
  isExclusionViolation,
  isUniqueViolation,
  pgErrorCode,
  PG_EXCLUSION_VIOLATION,
} from './errors'

/** The shape Drizzle actually throws: the driver error is on `cause`. */
function drizzleError(code: string) {
  const wrapped = new Error('Failed query: update ...') as Error & { cause?: unknown }
  wrapped.cause = Object.assign(new Error('conflicting key value'), { code })
  return wrapped
}

describe('pgErrorCode', () => {
  it('finds the code on a bare driver error', () => {
    expect(pgErrorCode(Object.assign(new Error('x'), { code: '23505' }))).toBe('23505')
  })

  it('finds the code Drizzle buried under `cause` — the whole reason this exists', () => {
    expect(pgErrorCode(drizzleError('23505'))).toBe('23505')
  })

  it('walks more than one level of wrapping', () => {
    const outer = new Error('outer') as Error & { cause?: unknown }
    outer.cause = drizzleError(PG_EXCLUSION_VIOLATION)
    expect(pgErrorCode(outer)).toBe(PG_EXCLUSION_VIOLATION)
  })

  it('is null for anything without a code', () => {
    expect(pgErrorCode(new Error('plain'))).toBeNull()
    expect(pgErrorCode(null)).toBeNull()
    expect(pgErrorCode('a string')).toBeNull()
    expect(pgErrorCode(undefined)).toBeNull()
  })

  it('terminates on a cause cycle rather than spinning', () => {
    const a = new Error('a') as Error & { cause?: unknown }
    a.cause = a
    expect(pgErrorCode(a)).toBeNull()
  })
})

describe('the named checks', () => {
  it('tell the two constraint failures apart', () => {
    expect(isUniqueViolation(drizzleError('23505'))).toBe(true)
    expect(isUniqueViolation(drizzleError('23P01'))).toBe(false)
    expect(isExclusionViolation(drizzleError('23P01'))).toBe(true)
    expect(isExclusionViolation(drizzleError('23505'))).toBe(false)
  })
})
