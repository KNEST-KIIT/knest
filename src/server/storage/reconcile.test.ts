import { describe, expect, it } from 'vitest'
import { GRACE_MS, planReconciliation } from './reconcile'

const NOW = Date.parse('2026-10-11T12:00:00Z')
const key = (n: number, day = '2026-10-01') => `${day}/${n.toString(16).padStart(32, '0')}.pdf`
const obj = (k: string, ageMs: number) => ({ key: k, size: 10, lastModified: new Date(NOW - ageMs) })

describe('upload orphan reconciliation', () => {
  it('flags only old objects that no row references', () => {
    const plan = planReconciliation({
      now: NOW,
      knownKeys: new Set([key(1)]),
      objects: [obj(key(1), 10 * GRACE_MS), obj(key(2), 10 * GRACE_MS), obj(key(3), 1000)],
    })
    expect(plan.orphans).toEqual([key(2)])
    expect(plan.refused).toBeUndefined()
  })

  it('never considers CMS media or foreign keys', () => {
    const plan = planReconciliation({
      now: NOW,
      knownKeys: new Set(),
      objects: [obj('media/photo.png', 10 * GRACE_MS), obj('README.txt', 10 * GRACE_MS), obj('2026-10-01/short.pdf', 10 * GRACE_MS)],
    })
    expect(plan.considered).toBe(0)
    expect(plan.orphans).toEqual([])
  })

  it('reports rows whose object is gone', () => {
    const plan = planReconciliation({ now: NOW, knownKeys: new Set([key(9)]), objects: [] })
    expect(plan.missing).toEqual([key(9)])
  })

  it('refuses to act when the table looks empty beside a populated bucket', () => {
    const objects = Array.from({ length: 12 }, (_, i) => obj(key(i), 10 * GRACE_MS))
    const plan = planReconciliation({ now: NOW, knownKeys: new Set(), objects })
    expect(plan.refused).toMatch(/lists no documents/)
  })

  it('refuses when most objects look orphaned', () => {
    const objects = Array.from({ length: 30 }, (_, i) => obj(key(i), 10 * GRACE_MS))
    const plan = planReconciliation({ now: NOW, knownKeys: new Set([key(0), key(1)]), objects })
    expect(plan.refused).toMatch(/more than half/)
  })
})
