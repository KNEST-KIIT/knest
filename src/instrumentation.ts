export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { checkProductionEnv, shouldCheckEnv } = await import('@/server/env')
  if (!shouldCheckEnv(process.env)) return

  const check = checkProductionEnv(process.env)
  if (!check.ok) {
    // Fail closed: a server that cannot store documents, send mail or sign
    // sessions safely should not start and look healthy. Names only, no values.
    throw new Error(`Invalid production environment:\n - ${check.problems.join('\n - ')}`)
  }

  // Uploads fail closed without a scanner (src/server/security/malware-scan.ts). That is correct, but it
  // must not be silent: with no scanner every application document is refused. The line below is alarmed.
  if (!process.env.MALWARE_SCANNER_URL) {
    console.error('malware_scanner_not_configured every document upload will be refused until MALWARE_SCANNER_URL is set')
  }

  // Retry mail that could not be sent when it was requested (src/server/email/outbox.ts).
  const { startOutboxWorker } = await import('@/server/email/outbox')
  startOutboxWorker()

  // Daily removal of expired sessions, expired tokens and idle rate-limit buckets.
  const { startCleanupWorker } = await import('@/server/maintenance/cleanup')
  startCleanupWorker()

  // Daily comparison of the document bucket with the database; dry run unless STORAGE_RECONCILE=apply.
  const { startReconcileWorker } = await import('@/server/storage/reconcile-worker')
  startReconcileWorker()
}
