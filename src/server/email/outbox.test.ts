import { describe, expect, it } from 'vitest'
import { backoffMs, describeError, MAX_ATTEMPTS } from './outbox'

describe('email outbox policy', () => {
  it('backs off with a growing delay and caps at twelve hours', () => {
    const delays = Array.from({ length: MAX_ATTEMPTS }, (_, i) => backoffMs(i + 1))
    expect(delays[0]).toBe(60_000)
    for (let i = 1; i < delays.length; i++) expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]!)
    expect(backoffMs(99)).toBe(12 * 60 * 60_000)
    expect(backoffMs(0)).toBe(60_000)
  })

  it('records a provider error without recipient addresses and within a bound', () => {
    const text = describeError(new Error('Email address is not verified: person@example.org\n   in region ap-south-1 ' + 'x'.repeat(500)))
    expect(text).not.toContain('person@example.org')
    expect(text).toContain('<address>')
    expect(text).not.toContain('\n')
    expect(text.length).toBeLessThanOrEqual(300)
  })
})
