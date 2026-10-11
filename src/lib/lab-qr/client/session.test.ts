import { describe, expect, it } from 'vitest'
import { ROSTER_CACHE_TTL_MS } from '../constants'
import { loadPassEntries, loadRosterEntries, resolveIdentity } from './session'
import { MemoryDeviceStore } from './store'

const NOW = Date.parse('2026-10-20T10:00:00Z')
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
const offline = (() => Promise.reject(new TypeError('network'))) as unknown as typeof fetch

describe('resolveIdentity', () => {
  it('takes the server answer, remembers it, and falls back to it for 24 hours when offline', async () => {
    const store = new MemoryDeviceStore()
    const online = (() => json({ userId: 'u1', name: 'Asha', isStaff: false })) as unknown as typeof fetch
    expect(await resolveIdentity(store, online, NOW)).toMatchObject({ identity: { userId: 'u1' }, offline: false, signedOut: false })
    expect(await resolveIdentity(store, offline, NOW + 60_000)).toMatchObject({ identity: { userId: 'u1' }, offline: true })
    expect((await resolveIdentity(store, offline, NOW + ROSTER_CACHE_TTL_MS + 1)).identity).toBeNull()
  })

  it('clears identity and cached data when the session has ended', async () => {
    const store = new MemoryDeviceStore()
    await resolveIdentity(store, (() => json({ userId: 'u1', name: 'A', isStaff: true })) as unknown as typeof fetch, NOW)
    await loadRosterEntries(store, 'u1', (() => json({ entries: [{ bookingId: 'b' }] })) as unknown as typeof fetch, NOW)
    const out = await resolveIdentity(store, (() => json({}, 401)) as unknown as typeof fetch, NOW)
    expect(out).toMatchObject({ identity: null, signedOut: true })
    expect((await loadRosterEntries(store, 'u1', offline, NOW)).source).toBe('none')
  })

  it('wipes the previous person cache when someone else signs in on the same device', async () => {
    const store = new MemoryDeviceStore()
    await resolveIdentity(store, (() => json({ userId: 'u1', name: 'A', isStaff: true })) as unknown as typeof fetch, NOW)
    await loadRosterEntries(store, 'u1', (() => json({ entries: [{ bookingId: 'b' }] })) as unknown as typeof fetch, NOW)
    await resolveIdentity(store, (() => json({ userId: 'u2', name: 'B', isStaff: true })) as unknown as typeof fetch, NOW + 1000)
    expect((await loadRosterEntries(store, 'u1', offline, NOW + 2000)).entries).toEqual([])
  })
})

describe('roster and pass caches', () => {
  it('serve the cache offline, never past 24 hours, and never to another user', async () => {
    const store = new MemoryDeviceStore()
    const ok = (() => json({ entries: [{ bookingId: 'b1' }] })) as unknown as typeof fetch
    expect(await loadRosterEntries(store, 'u1', ok, NOW)).toMatchObject({ source: 'network' })
    expect(await loadRosterEntries(store, 'u1', offline, NOW + 3_600_000)).toMatchObject({ source: 'cache', entries: [{ bookingId: 'b1' }] })
    expect((await loadRosterEntries(store, 'u1', offline, NOW + ROSTER_CACHE_TTL_MS + 1)).source).toBe('none')
    await loadRosterEntries(store, 'u1', ok, NOW)
    expect((await loadRosterEntries(store, 'u2', offline, NOW)).source).toBe('none')
  })

  it('keep passes and roster apart', async () => {
    const store = new MemoryDeviceStore()
    await loadPassEntries(store, 'u1', (() => json({ passes: [{ bookingId: 'p' }] })) as unknown as typeof fetch, NOW)
    expect((await loadRosterEntries(store, 'u1', offline, NOW)).source).toBe('none')
    expect(await loadPassEntries(store, 'u1', offline, NOW)).toMatchObject({ source: 'cache', entries: [{ bookingId: 'p' }] })
  })

  it('empties the cache when the server says this person runs no lab', async () => {
    const store = new MemoryDeviceStore()
    await loadRosterEntries(store, 'u1', (() => json({ entries: [{ bookingId: 'b' }] })) as unknown as typeof fetch, NOW)
    await loadRosterEntries(store, 'u1', (() => json({}, 403)) as unknown as typeof fetch, NOW)
    expect((await loadRosterEntries(store, 'u1', offline, NOW)).source).toBe('none')
  })
})
