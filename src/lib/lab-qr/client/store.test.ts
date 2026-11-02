import { describe, expect, it } from 'vitest'
import { MemoryDeviceStore, ResilientDeviceStore, type DeviceStore } from './store'

/** A store that exists but refuses every operation, like IndexedDB in a private window. */
const broken: DeviceStore = {
  get: () => Promise.reject(new Error('blocked')),
  put: () => Promise.reject(new Error('blocked')),
  delete: () => Promise.reject(new Error('blocked')),
  all: () => Promise.reject(new Error('blocked')),
  clear: () => Promise.reject(new Error('blocked')),
}

describe('ResilientDeviceStore', () => {
  it('keeps using a working primary and reports it as persistent', async () => {
    const store = new ResilientDeviceStore(new MemoryDeviceStore())
    await store.put('outbox', 'a', { id: 'a' })
    expect(await store.get('outbox', 'a')).toEqual({ id: 'a' })
    expect(await store.probe()).toBe(true)
  })

  it('falls back to memory instead of losing the scan, and says it is not persistent', async () => {
    const store = new ResilientDeviceStore(broken)
    await store.put('outbox', 'scan-1', { id: 'scan-1' })
    expect(await store.get('outbox', 'scan-1')).toEqual({ id: 'scan-1' })
    expect(await store.all('outbox')).toHaveLength(1)
    expect(store.persistent()).toBe(false)
  })

  it('finds an unusable store when probed, before any scan', async () => {
    const store = new ResilientDeviceStore(broken)
    expect(await store.probe()).toBe(false)
  })

  it('has no persistence when there is no primary at all', async () => {
    const store = new ResilientDeviceStore(null)
    expect(store.persistent()).toBe(false)
    await store.put('keys', 'k', 1)
    expect(await store.get('keys', 'k')).toBe(1)
  })
})
