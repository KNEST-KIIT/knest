export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { checkProductionEnv, shouldCheckEnv } = await import('@/server/env')

  if (shouldCheckEnv(process.env)) {
    const check = checkProductionEnv(process.env)
    if (!check.ok) {
      // Fail closed: a server that cannot store documents, send mail or sign
      // sessions safely should not start and look healthy. Names only, no values.
      throw new Error(`Invalid production environment:\n - ${check.problems.join('\n - ')}`)
    }

    // Retry mail that could not be sent when it was requested (src/server/email/outbox.ts).
    const { startOutboxWorker } = await import('@/server/email/outbox')
    startOutboxWorker()

    // Daily comparison of the clean documents bucket with the database; dry run unless STORAGE_RECONCILE=apply.
    const { startReconcileWorker } = await import('@/server/storage/reconcile-worker')
    startReconcileWorker()
  }

  // Applies GuardDuty's malware verdicts to uploaded documents (src/server/security/scan-worker.ts). It also runs
  // outside production whenever screening is configured (the local stand-ins), because without it an upload would
  // wait for a verdict that nothing is there to apply. With no screening configuration it does nothing.
  const { startMalwareScanWorker } = await import('@/server/security/scan-worker')
  startMalwareScanWorker()
}
