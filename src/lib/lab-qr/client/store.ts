/**
 * Device-local storage for lab attendance: the device key pair, the outbox of unsent scan events,
 * and the bounded roster cache. One small interface with two implementations, so the logic that uses
 * it is tested against memory and the IndexedDB one stays a thin shell.
 *
 * Stored here: signed tokens, key handles, and a 24 h roster (names, never e-mail addresses).
 * Never stored in Cache Storage: nothing authenticated is cached by the service worker.
 */

export const DB_NAME = 'knest-lab-attendance'
export const DB_VERSION = 1
export type StoreName = 'keys' | 'outbox' | 'roster' | 'meta'
export const STORE_NAMES: StoreName[] = ['keys', 'outbox', 'roster', 'meta']

export interface DeviceStore {
  get<T>(store: StoreName, key: string): Promise<T | undefined>
  put(store: StoreName, key: string, value: unknown): Promise<void>
  delete(store: StoreName, key: string): Promise<void>
  all<T>(store: StoreName): Promise<T[]>
  clear(store: StoreName): Promise<void>
}

export class MemoryDeviceStore implements DeviceStore {
  private data = new Map<StoreName, Map<string, unknown>>()
  private table(store: StoreName) {
    if (!this.data.has(store)) this.data.set(store, new Map())
    return this.data.get(store)!
  }
  async get<T>(store: StoreName, key: string) {
    return this.table(store).get(key) as T | undefined
  }
  async put(store: StoreName, key: string, value: unknown) {
    this.table(store).set(key, value)
  }
  async delete(store: StoreName, key: string) {
    this.table(store).delete(key)
  }
  async all<T>(store: StoreName) {
    return [...this.table(store).values()] as T[]
  }
  async clear(store: StoreName) {
    this.table(store).clear()
  }
}

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

export class IndexedDbDeviceStore implements DeviceStore {
  private dbPromise: Promise<IDBDatabase> | null = null
  constructor(private factory: IDBFactory = globalThis.indexedDB) {}

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = this.factory.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
          for (const name of STORE_NAMES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name)
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    }
    return this.dbPromise
  }

  private async run<T>(store: StoreName, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open()
    return request(action(db.transaction(store, mode).objectStore(store)))
  }

  get<T>(store: StoreName, key: string) {
    return this.run<T | undefined>(store, 'readonly', (s) => s.get(key))
  }
  async put(store: StoreName, key: string, value: unknown) {
    await this.run(store, 'readwrite', (s) => s.put(value, key))
  }
  async delete(store: StoreName, key: string) {
    await this.run(store, 'readwrite', (s) => s.delete(key))
  }
  all<T>(store: StoreName) {
    return this.run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
  }
  async clear(store: StoreName) {
    await this.run(store, 'readwrite', (s) => s.clear())
  }
}

/**
 * IndexedDB when it works, memory when it does not. `indexedDB` can exist and still refuse to open (Safari
 * private browsing, storage blocked by policy, a full disk), and that refusal used to surface on the first
 * scan, which was then lost. Here the first failed operation switches to memory for good, so a scan is
 * still queued and sent while the page stays open, and `persistent()` says the truth for the warning.
 */
export class ResilientDeviceStore implements DeviceStore {
  private active: DeviceStore
  private durable: boolean
  constructor(primary: DeviceStore | null, private fallback: DeviceStore = new MemoryDeviceStore()) {
    this.active = primary ?? fallback
    this.durable = primary !== null
  }

  persistent(): boolean {
    return this.durable
  }

  /** Opens the primary store once so an unusable one is found now rather than during a scan. */
  async probe(): Promise<boolean> {
    await this.run((s) => s.get<unknown>('meta', '__probe__'))
    return this.durable
  }

  private async run<T>(op: (store: DeviceStore) => Promise<T>): Promise<T> {
    try {
      return await op(this.active)
    } catch (error) {
      if (this.active === this.fallback) throw error
      this.active = this.fallback
      this.durable = false
      return op(this.active)
    }
  }

  get<T>(store: StoreName, key: string) {
    return this.run((s) => s.get<T>(store, key))
  }
  put(store: StoreName, key: string, value: unknown) {
    return this.run((s) => s.put(store, key, value))
  }
  delete(store: StoreName, key: string) {
    return this.run((s) => s.delete(store, key))
  }
  all<T>(store: StoreName) {
    return this.run((s) => s.all<T>(store))
  }
  clear(store: StoreName) {
    return this.run((s) => s.clear(store))
  }
}

/** The browser's store, or memory when IndexedDB is unavailable (the page then says keys will not persist). */
export function openDeviceStore(): { store: ResilientDeviceStore; persistent: boolean } {
  let primary: DeviceStore | null = null
  try {
    if (typeof indexedDB !== 'undefined') primary = new IndexedDbDeviceStore()
  } catch {
    // fall through to memory
  }
  const store = new ResilientDeviceStore(primary)
  return { store, persistent: store.persistent() }
}
