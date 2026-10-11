import { reconcileDocuments } from './reconcile'

/**
 * Runs orphan reconciliation once a day inside the web process (a single host, so there is no
 * contention; an overlapping run elsewhere would only repeat idempotent deletes). The first run
 * is a dry run: it logs what it would remove (`storage_reconcile ... applied=false`) so the
 * counts can be read before deletion is ever enabled with STORAGE_RECONCILE=apply.
 */
const DAY_MS = 24 * 60 * 60 * 1000
let timer: ReturnType<typeof setInterval> | undefined

export function startReconcileWorker(): void {
  if (timer || !process.env.S3_BUCKET || process.env.STORAGE_RECONCILE === 'off') return
  const run = () =>
    reconcileDocuments({ apply: process.env.STORAGE_RECONCILE === 'apply' }).catch((error) => {
      console.error('storage_reconcile_failed', error instanceof Error ? error.message : String(error))
    })
  // First pass shortly after start, then daily.
  setTimeout(run, 5 * 60 * 1000).unref?.()
  timer = setInterval(run, DAY_MS)
  timer.unref?.()
}
