import { describe, expect, it, vi } from 'vitest'

// The module reads the database at import time; these tests only exercise the in-memory wrapper.
vi.mock('@/db/client', () => ({ db: {} }))
vi.mock('@/server/auth/guards', () => ({ requireUserOrThrow: vi.fn() }))
vi.mock('./access', () => ({ actorFor: vi.fn(), canManage: vi.fn(), isLabAdmin: vi.fn(), requireManager: vi.fn() }))

import type { Lookups } from '@/lib/lab-qr/decide'
import { memoisedLookups } from './attendance-qr'

function counting() {
  const calls = { key: 0, booking: 0, labRole: 0 }
  const base: Lookups = {
    key: async () => {
      calls.key += 1
      return null
    },
    booking: async () => {
      calls.booking += 1
      return null
    },
    labRole: async () => {
      calls.labRole += 1
      return 'assistant'
    },
  }
  return { calls, lookups: memoisedLookups(base) }
}

describe('memoisedLookups', () => {
  it('asks the database once per key and per person-and-lab, however many scans use them', async () => {
    const { calls, lookups } = counting()
    for (let i = 0; i < 50; i++) {
      await lookups.key('device-a')
      await lookups.labRole('user-1', 'lab-1')
    }
    await lookups.key('device-b')
    await lookups.labRole('user-1', 'lab-2')
    expect(calls.key).toBe(2)
    expect(calls.labRole).toBe(2)
  })

  it('never remembers a booking, because an earlier scan in the batch may have completed it', async () => {
    const { calls, lookups } = counting()
    await lookups.booking('b-1')
    await lookups.booking('b-1')
    await lookups.booking('b-1')
    expect(calls.booking).toBe(3)
  })
})
