import { db } from '@/db/client'
import { applicationDocuments } from '@/db/schema'
import { deleteFile, listFiles, type StoredObject } from '@/server/storage'

/**
 * Orphan reconciliation for application documents.
 *
 * Uploads write the object first and the database row second, and a superseded object is
 * deleted afterwards on a best-effort basis (src/server/applications/actions.ts). A crash or a
 * failed delete between those steps leaves an object that no row points at. This compares the
 * bucket with the table and removes such objects once they are old enough that no upload can
 * still be in flight.
 *
 * Only keys that look like generated document keys (YYYY-MM-DD/<hex>.<ext>) are considered, so
 * CMS media (media/...) and anything else in the bucket is never touched. Production buckets
 * are versioned, so a removal leaves a recoverable delete marker.
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
  knownKeys: Set<string>
  now: number
  graceMs?: number
}): ReconcilePlan {
  const grace = input.graceMs ?? GRACE_MS
  const documents = input.objects.filter((o) => DOCUMENT_KEY.test(o.key))
  const inBucket = new Set(documents.map((o) => o.key))
  const orphans = documents
    .filter((o) => !input.knownKeys.has(o.key) && input.now - o.lastModified.getTime() >= grace)
    .map((o) => o.key)
  const missing = [...input.knownKeys].filter((key) => DOCUMENT_KEY.test(key) && !inBucket.has(key))
  const plan: ReconcilePlan = { considered: documents.length, orphans, missing }
  // An empty table beside a non-empty bucket, or a majority of orphans, means the database the
  // job is looking at is not the one the objects belong to. Do not delete on that evidence.
  if (documents.length > 10 && input.knownKeys.size === 0) plan.refused = 'the database lists no documents but the bucket has many'
  else if (documents.length >= 20 && orphans.length / documents.length > 0.5) plan.refused = 'more than half of the objects look orphaned'
  return plan
}

export type ReconcileResult = ReconcilePlan & { removed: number; applied: boolean }

export async function reconcileDocuments(options: { apply: boolean; now?: number } = { apply: false }): Promise<ReconcileResult> {
  const [objects, rows] = await Promise.all([
    listFiles(),
    db.select({ key: applicationDocuments.storageKey }).from(applicationDocuments),
  ])
  const plan = planReconciliation({ objects, knownKeys: new Set(rows.map((r) => r.key)), now: options.now ?? Date.now() })
  let removed = 0
  if (options.apply && !plan.refused) {
    for (const key of plan.orphans.slice(0, MAX_REMOVALS)) {
      // Re-check the row immediately before removing: an upload may have just recorded it.
      const again = await db.query.applicationDocuments.findFirst({ where: (t, { eq }) => eq(t.storageKey, key), columns: { id: true } })
      if (again) continue
      await deleteFile(key)
      removed += 1
    }
  }
  console.log(
    `storage_reconcile considered=${plan.considered} orphans=${plan.orphans.length} missing=${plan.missing.length} removed=${removed} applied=${options.apply && !plan.refused}${plan.refused ? ` refused="${plan.refused}"` : ''}`,
  )
  return { ...plan, removed, applied: options.apply && !plan.refused }
}
