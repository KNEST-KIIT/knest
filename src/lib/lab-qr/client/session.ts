import { ROSTER_CACHE_TTL_MS } from '../constants'
import { loadRoster, saveRoster, wipeRoster, type CacheKind } from './roster-cache'
import type { RosterBooking, KeyEntry } from './flows'
import type { DeviceStore } from './store'
import type { StoredDeviceKey } from './device-key'
import { ensureDeviceKey } from './device-key'

/**
 * Who this device is working for, and the cached data that belongs to them. The device app reads
 * everything from here so it keeps working offline; the network only refreshes it.
 */

export type Identity = { userId: string; name: string; isStaff: boolean; savedAt: number }
export type IdentityResult = { identity: Identity | null; signedOut: boolean; offline: boolean }

const IDENTITY_KEY = 'identity'
type Fetch = typeof fetch

/** The signed-in person from the server, falling back to the last one this device knew (within 24 h). */
export async function resolveIdentity(store: DeviceStore, fetchImpl: Fetch, now = Date.now()): Promise<IdentityResult> {
  const cached = await store.get<Identity>('meta', IDENTITY_KEY)
  let res: Response
  try {
    res = await fetchImpl('/api/lab-attendance/me', { credentials: 'same-origin', cache: 'no-store' })
  } catch {
    const fresh = cached && now - cached.savedAt < ROSTER_CACHE_TTL_MS ? cached : null
    return { identity: fresh, signedOut: false, offline: true }
  }
  if (res.status === 401) {
    await store.delete('meta', IDENTITY_KEY)
    await wipeRoster(store)
    return { identity: null, signedOut: true, offline: false }
  }
  if (!res.ok) {
    const fresh = cached && now - cached.savedAt < ROSTER_CACHE_TTL_MS ? cached : null
    return { identity: fresh, signedOut: false, offline: true }
  }
  const body = (await res.json().catch(() => null)) as { userId?: string; name?: string; isStaff?: boolean } | null
  if (!body?.userId) return { identity: null, signedOut: false, offline: true }
  // Another person signed in on this device: nothing cached for the last one may be shown.
  if (cached && cached.userId !== body.userId) await wipeRoster(store)
  const identity: Identity = { userId: body.userId, name: body.name ?? 'Member', isStaff: !!body.isStaff, savedAt: now }
  await store.put('meta', IDENTITY_KEY, identity)
  return { identity, signedOut: false, offline: false }
}

export type Loaded<T> = { entries: T[]; source: 'network' | 'cache' | 'none'; expiresAt: number | null }

async function refresh<T>(store: DeviceStore, userId: string, fetchImpl: Fetch, url: string, field: string, kind: CacheKind, now: number): Promise<Loaded<T>> {
  try {
    const res = await fetchImpl(url, { credentials: 'same-origin', cache: 'no-store' })
    if (res.ok) {
      const body = (await res.json()) as Record<string, unknown>
      const entries = body[field] as T[] | undefined
      if (Array.isArray(entries)) {
        await saveRoster(store, userId, entries, now, kind)
        return { entries, source: 'network', expiresAt: now + ROSTER_CACHE_TTL_MS }
      }
    } else if (res.status === 403) {
      // Not a lab person: nothing to keep.
      await store.delete('roster', kind)
      return { entries: [], source: 'network', expiresAt: null }
    }
  } catch {
    // offline: fall through to the cache
  }
  const cached = await loadRoster<T>(store, userId, now, kind)
  return cached ? { entries: cached.entries, source: 'cache', expiresAt: cached.expiresAt } : { entries: [], source: 'none', expiresAt: null }
}

export type RosterEntry = RosterBooking & { labName: string; labSlug: string; checks: { in: string; out: string; reviewPending: boolean } }
export type PassEntry = {
  bookingId: string
  labId: string
  labName: string
  startsAt: string
  endsAt: string
  staffKeys: KeyEntry[]
  checks: { in: string; out: string; reviewPending: boolean }
}

export const loadRosterEntries = (store: DeviceStore, userId: string, fetchImpl: Fetch, now = Date.now()) =>
  refresh<RosterEntry>(store, userId, fetchImpl, '/api/lab-attendance/roster', 'entries', 'roster', now)

export const loadPassEntries = (store: DeviceStore, userId: string, fetchImpl: Fetch, now = Date.now()) =>
  refresh<PassEntry>(store, userId, fetchImpl, '/api/lab-attendance/passes', 'passes', 'passes', now)

/** The device key, registering it online when it has not been registered yet. */
export function ensureKey(store: DeviceStore, userId: string, fetchImpl: Fetch, label: string): Promise<StoredDeviceKey> {
  return ensureDeviceKey(store, userId, async (body) => {
    const res = await fetchImpl('/api/lab-attendance/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
    return res.ok
  }, label)
}
