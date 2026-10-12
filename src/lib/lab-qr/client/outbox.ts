import { MAX_BATCH_EVENTS, UNSYNCED_WARN_MS } from '../constants'
import type { DeviceStore } from './store'

/**
 * The application-level outbox (threat model section 5, T6). Signed scan events queue here and are
 * sent on app open, on the `online` event, from a "Sync now" button and, where the browser allows it,
 * from Background Sync. iOS Safari has no Background Sync, so nothing depends on it.
 *
 * Delivery is idempotent: the server keys on the event id, so sending twice is harmless and an event
 * is removed locally only after the server has answered for it.
 */

export type OutboxItem = { id: string; userId: string; token: string; createdAt: number; lastError: string | null; result: ItemResult | null }
export type ItemResult = { status: 'accepted' | 'review' | 'rejected'; code: string | null; verified: boolean; at: number }

export type ServerResult = {
  id: string | null
  status: 'accepted' | 'review' | 'rejected'
  code: string | null
  check: { action: 'in' | 'out'; state: 'partial' | 'verified' } | null
}

export type SendBatch = (batch: { clientNowMs: number; events: string[] }) => Promise<{ kind: 'ok'; results: ServerResult[] } | { kind: 'signed-out' } | { kind: 'retry'; reason: string }>

export type OutboxStatus = { pending: number; oldestAgeMs: number | null; stale: boolean; results: OutboxItem[] }

export class Outbox {
  constructor(
    private store: DeviceStore,
    private userId: string,
    private now: () => number = Date.now,
  ) {}

  async enqueue(id: string, token: string): Promise<void> {
    const existing = await this.store.get<OutboxItem>('outbox', id)
    if (existing) return
    await this.store.put('outbox', id, { id, userId: this.userId, token, createdAt: this.now(), lastError: null, result: null } satisfies OutboxItem)
  }

  private async mine(): Promise<OutboxItem[]> {
    return (await this.store.all<OutboxItem>('outbox')).filter((i) => i.userId === this.userId).sort((a, b) => a.createdAt - b.createdAt)
  }

  /** What the screen shows: unsent count, how old the oldest is, and results since the last clear. */
  async status(): Promise<OutboxStatus> {
    const items = await this.mine()
    const pending = items.filter((i) => i.result === null)
    const oldest = pending[0]?.createdAt
    const age = oldest === undefined ? null : this.now() - oldest
    return { pending: pending.length, oldestAgeMs: age, stale: age !== null && age > UNSYNCED_WARN_MS, results: items.filter((i) => i.result !== null) }
  }

  /** Sends everything that is pending in batches. Never throws; a failure leaves items queued. */
  async flush(send: SendBatch): Promise<{ sent: number; remaining: number; signedOut: boolean }> {
    let sent = 0
    let signedOut = false
    const pending = (await this.mine()).filter((i) => i.result === null)
    for (let i = 0; i < pending.length; i += MAX_BATCH_EVENTS) {
      const slice = pending.slice(i, i + MAX_BATCH_EVENTS)
      let outcome: Awaited<ReturnType<SendBatch>>
      try {
        outcome = await send({ clientNowMs: this.now(), events: slice.map((s) => s.token) })
      } catch (error) {
        outcome = { kind: 'retry', reason: error instanceof Error ? error.message : 'network' }
      }
      if (outcome.kind === 'signed-out') {
        signedOut = true
        break
      }
      if (outcome.kind === 'retry') {
        for (const item of slice) await this.store.put('outbox', item.id, { ...item, lastError: outcome.reason })
        break
      }
      // results come back in the order sent
      for (let n = 0; n < slice.length; n++) {
        const item = slice[n]!
        const r = outcome.results[n]
        if (!r) {
          await this.store.put('outbox', item.id, { ...item, lastError: 'no answer' })
          continue
        }
        sent += 1
        await this.store.put('outbox', item.id, {
          ...item,
          lastError: null,
          result: { status: r.status, code: r.code, verified: r.check?.state === 'verified', at: this.now() } satisfies ItemResult,
        })
      }
    }
    const remaining = (await this.mine()).filter((i) => i.result === null).length
    return { sent, remaining, signedOut }
  }

  /** Removes answered items from the list on screen. Unanswered items are never removed here. */
  async clearAnswered(): Promise<void> {
    for (const item of await this.mine()) if (item.result) await this.store.delete('outbox', item.id)
  }
}

/** The fetch-backed sender used in the page and by Background Sync. */
export function fetchSender(fetchImpl: typeof fetch = fetch): SendBatch {
  return async (batch) => {
    const res = await fetchImpl('/api/lab-attendance/scans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(batch),
    })
    if (res.status === 401) return { kind: 'signed-out' }
    if (!res.ok) return { kind: 'retry', reason: `server ${res.status}` }
    const data = (await res.json().catch(() => null)) as { results?: ServerResult[] } | null
    if (!data?.results) return { kind: 'retry', reason: 'bad response' }
    return { kind: 'ok', results: data.results }
  }
}
