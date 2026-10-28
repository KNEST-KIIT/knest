import { db } from '@/db/client'
import { applicationDocuments } from '@/db/schema'
import { documentStorage, type StoredObject } from '@/server/storage'

/**
 * Orphan reconciliation for the clean documents bucket.
 *
 * A document reaches this bucket only by promotion after a clean verdict, and a superseded one is
 * removed afterwards on a best-effort basis (src/server/applications/actions.ts). A crash or a
 * failed delete between those steps leaves an object that no row points at. This compares the
 * bucket with the table and removes such objects once they are old enough that no promotion can
 * still be in flight. The quarantine bucket is not reconciled here: it holds only objects waiting
 * for, or rejected by, screening, and its lifecycle rules remove them.
 *
 * Only keys that look like generated document keys (YYYY-MM-DD/<hex>.<ext>) are considered, so
 * anything else in the bucket is never touched. The bucket is versioned, so a removal leaves a
 * recoverable delete marker.
 */

const DOCUMENT_KEY = /^\d{4}-\d{2}-\d{2}\/[0-9a-f]{32}(\.[A-Za-z0-9]{1,9})?$/
export const GRACE_MS = 48 * 60 * 60 * 1000
export const MAX_REMOVALS = 200

export type ReconcilePlan = {
  considered: number
  orphans: string[]
  /** Rows whose object is not in the bucket. Reported, never repaired here. */
  missing: string[]
  /** Set when the comparison looks untrustworthy; nothing may be removed. */
  refused?: string
}

/** Pure: decides what is an orphan, with guards against acting on a bad comparison. */
export function planReconciliation(input: {
  objects: StoredObject[]
  /** Every key any row points at, whatever its screening state: none of these may be removed. */
  knownKeys: Set<string>
  /** Keys that must be present because their row is `clean`. Defaults to knownKeys. */
  expectedKeys?: Set<string>
  now: number
  graceMs?: number
}): ReconcilePlan {
  const grace = input.graceMs ?? GRACE_MS
  const documents = input.objects.filter((o) => DOCUMENT_KEY.test(o.key))
  const inBucket = new Set(documents.map((o) => o.key))
  const orphans = documents
    .filter((o) => !input.knownKeys.has(o.key) && input.now - o.lastModified.getTime() >= grace)
    .map((o) => o.key)
  const missing = [...(input.expectedKeys ?? input.knownKeys)].filter((key) => DOCUMENT_KEY.test(key) && !inBucket.has(key))
  const plan: ReconcilePlan = { considered: documents.length, orphans, missing }
  // An empty table beside a non-empty bucket, or a majority of orphans, means the database the
  // job is looking at is not the one the objects belong to. Do not delete on that evidence.
  if (documents.length > 10 && input.knownKeys.size === 0) plan.refused = 'the database lists no documents but the bucket has many'
  else if (documents.length >= 20 && orphans.length / documents.length > 0.5) plan.refused = 'more than half of the objects look orphaned'
  return plan
}

export type ReconcileResult = ReconcilePlan & { removed: number; applied: boolean }

export async function reconcileDocuments(options: { apply: boolean; now?: number } = { apply: false }): Promise<ReconcileResult> {
  const storage = documentStorage()
  if (!storage) {
    console.log('storage_reconcile skipped reason=document-storage-not-configured')
    return { considered: 0, orphans: [], missing: [], refused: 'document storage is not configured', removed: 0, applied: false }
  }
  const [objects, rows] = await Promise.all([
    storage.listClean(),
    db.select({ key: applicationDocuments.storageKey, status: applicationDocuments.scanStatus }).from(applicationDocuments),
  ])
  const plan = planReconciliation({
    objects,
    knownKeys: new Set(rows.map((r) => r.key)),
    expectedKeys: new Set(rows.filter((r) => r.status === 'clean').map((r) => r.key)),
    now: options.now ?? Date.now(),
  })
  let removed = 0
  if (options.apply && !plan.refused) {
    for (const key of plan.orphans.slice(0, MAX_REMOVALS)) {
      // Re-check the row immediately before removing: an upload may have just recorded it.
      const again = await db.query.applicationDocuments.findFirst({ where: (t, { eq }) => eq(t.storageKey, key), columns: { id: true } })
      if (again) continue
      await storage.deleteClean(key)
      removed += 1
    }
  }
  console.log(
    `storage_reconcile considered=${plan.considered} orphans=${plan.orphans.length} missing=${plan.missing.length} removed=${removed} applied=${options.apply && !plan.refused}${plan.refused ? ` refused="${plan.refused}"` : ''}`,
  )
  return { ...plan, removed, applied: options.apply && !plan.refused }
}
