import { describe, expect, it } from 'vitest'
import { summariseSnapshot } from './snapshot'

describe('summariseSnapshot', () => {
  it('shows missing snapshots as a dash and scalars as text', () => {
    expect(summariseSnapshot(null)).toBe('—')
    expect(summariseSnapshot(undefined)).toBe('—')
    expect(summariseSnapshot('accepted')).toBe('accepted')
  })

  it('lists keys and values, nesting objects as JSON', () => {
    expect(summariseSnapshot({ status: 'submitted', note: null, detail: { a: 1 } })).toBe('status: submitted, note: null, detail: {"a":1}')
  })

  it('cuts long values and keeps an empty object readable', () => {
    const long = summariseSnapshot({ note: 'x'.repeat(500) }, 60)
    expect(long.length).toBe(60)
    expect(long.endsWith('…')).toBe(true)
    expect(summariseSnapshot({})).toBe('—')
  })
})
