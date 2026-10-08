import { compare, getRounds } from 'bcryptjs'
import { describe, expect, it } from 'vitest'
import { DUMMY_HASH } from './dummy-hash'

describe('DUMMY_HASH (KN-22a)', () => {
  it('is a well-formed 60-character bcrypt hash at cost 12', () => {
    expect(DUMMY_HASH).toHaveLength(60)
    expect(getRounds(DUMMY_HASH)).toBe(12)
  })

  it('does real work to reject a guess (not an instant malformed-hash return)', async () => {
    const t0 = performance.now()
    const ok = await compare('anything', DUMMY_HASH)
    const ms = performance.now() - t0
    expect(ok).toBe(false)
    expect(ms).toBeGreaterThan(30) // cost-12 bcrypt is hundreds of ms; a malformed hash returns in ~0
  })
})
