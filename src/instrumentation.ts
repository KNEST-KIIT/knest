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

  // Retry mail that could not be sent when it was requested (src/server/email/outbox.ts).
  const { startOutboxWorker } = await import('@/server/email/outbox')
  startOutboxWorker()

  // Daily comparison of the document bucket with the database; dry run unless STORAGE_RECONCILE=apply.
  const { startReconcileWorker } = await import('@/server/storage/reconcile-worker')
  startReconcileWorker()
}
