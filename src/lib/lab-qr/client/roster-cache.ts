import { ROSTER_CACHE_TTL_MS } from '../constants'
import type { DeviceStore } from './store'

/**
 * The roster a scanning device may keep offline: bounded to the next 24 hours, names only, expiring
 * 24 hours after it was fetched, owned by one user and wiped on logout or when another person signs
 * in on the same device (threat model T10 and T11).
 */

export type CachedRoster<T> = { userId: string; fetchedAt: number; expiresAt: number; entries: T[] }

/** One record per kind of cache held in the `roster` store. */
export type CacheKind = 'roster' | 'passes'

export async function saveRoster<T>(store: DeviceStore, userId: string, entries: T[], now = Date.now(), kind: CacheKind = 'roster'): Promise<void> {
  const record: CachedRoster<T> = { userId, fetchedAt: now, expiresAt: now + ROSTER_CACHE_TTL_MS, entries }
  await store.put('roster', kind, record)
}

/** Returns the cache only if it belongs to this user and has not expired; otherwise wipes it. */
export async function loadRoster<T>(store: DeviceStore, userId: string, now = Date.now(), kind: CacheKind = 'roster'): Promise<CachedRoster<T> | null> {
  const record = await store.get<CachedRoster<T>>('roster', kind)
  if (!record) return null
  if (record.userId !== userId || record.expiresAt <= now || record.fetchedAt > now + 5 * 60 * 1000) {
    await store.delete('roster', kind)
    return null
  }
  return record
}

export async function wipeRoster(store: DeviceStore): Promise<void> {
  await store.clear('roster')
}
