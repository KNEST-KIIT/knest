import { decideVerdict, GUARDDUTY_VALIDATION_KEY, parseScanResultMessage, type ParsedScanEvent } from './scan-verdict'
import type { ScanConfig } from './scan-config'
import { StorageError, type ObjectRef, type QuarantineUpload } from '@/server/storage/documents'

/**
 * Applies GuardDuty scan results to uploaded documents. One message in, one disposition out.
 *
 * What makes this fail closed:
 *  - A document becomes `clean` only through decideVerdict() (COMPLETED + NO_THREATS_FOUND), and only after the
 *    verdict is matched to the row by bucket, key AND version id, the ETag agrees, the version's own scan tag agrees,
 *    and the copy placed in clean storage proves the checksum recorded at upload.
 *  - Skipped, unsupported, failed and unrecognised results end in a rejected state, never in `clean`.
 *  - Every state change is a compare-and-set from `pending`, so a replayed or duplicated message changes nothing
 *    and two workers cannot disagree.
 *  - Anything that cannot be settled yet (the row is not visible, the tag has not appeared, S3 hiccups) is retried, and a
 *    message that never settles ends in the dead-letter queue and an alarm, not in an assumed success.
 *
 * It scans nothing and claims nothing about bytes. It trusts only what GuardDuty reported about one object version.
 */

export type DocumentScanStatus = 'pending' | 'clean' | 'infected' | 'unscannable' | 'scan_error'
export type RejectedStatus = Exclude<DocumentScanStatus, 'pending' | 'clean'>

export type DocumentRow = {
  id: string
  applicationId: string
  userId: string
  questionId: string
  fileName: string
  storageKey: string
  mimeType: string
  fileSize: number
  sha256: string | null
  scanStatus: DocumentScanStatus
  quarantine: { bucket: string; key: string; versionId: string; etag: string | null } | null
  uploadedAt: Date
}

export type Decision =
  | { status: 'clean'; result: 'NO_THREATS_FOUND'; reasons: string[]; threat: null; eventId: string; cleanVersionId: string }
  | { status: RejectedStatus; result: string; reasons: string[]; threat: string | null; eventId: string | null }

export interface ScanStore {
  findByBinding(binding: { bucket: string; key: string; versionId: string }): Promise<DocumentRow | null>
  findById(id: string): Promise<DocumentRow | null>
  /** Compare-and-set: moves the row out of `pending` only if it is still pending on the same quarantine version. True if this call did it. */
  decide(id: string, quarantineVersionId: string | null, decision: Decision): Promise<boolean>
  listPendingBefore(before: Date, limit: number): Promise<DocumentRow[]>
  pendingSummary(): Promise<{ count: number; oldest: Date | null }>
}

export interface ScanStorage {
  inspectQuarantine(ref: ObjectRef): Promise<{ scanTag: string | null; size?: number; etag?: string; checksumSha256Hex?: string }>
  promote(input: { source: QuarantineUpload; cleanKey: string; contentType: string; sha256Hex: string }): Promise<{ cleanVersionId: string }>
  deleteQuarantineVersion(ref: ObjectRef): Promise<void>
  deleteClean(key: string): Promise<void>
}

export interface ScanNotifier {
  documentRejected(row: DocumentRow, status: RejectedStatus, reasons: string[]): Promise<void>
}

export type ProcessDeps = {
  store: ScanStore
  storage: ScanStorage
  notifier: ScanNotifier
  config: Pick<ScanConfig, 'quarantineBucket' | 'region' | 'verdictDeadlineMinutes'>
  now: () => Date
  log: (line: string) => void
}

export type MessageContext = { body: string; sentAt: Date; receiveCount: number }
export type Disposition = { disposition: 'ack' | 'retry'; retryAfterSeconds?: number; outcome: string }

/** A verdict for an object no row knows about is held this long, in case the row is still being committed. */
export const UNKNOWN_OBJECT_GRACE_MS = 15 * 60_000
/** A clean verdict whose scan tag has not appeared yet is held this long before it is treated as an error. */
export const TAG_GRACE_MS = 20 * 60_000
/** A clean verdict that cannot be promoted because S3 keeps failing is held this long before it is treated as an error. */
export const PROMOTION_GRACE_MS = 60 * 60_000

/** The decision is already recorded when this runs; a failed notice must never turn it into a processing error. */
async function notifySafely(deps: ProcessDeps, row: DocumentRow, status: RejectedStatus, reasons: string[]): Promise<void> {
  try {
    await deps.notifier.documentRejected(row, status, reasons)
  } catch (error) {
    deps.log(line('malware_scan_notice_failed', { doc: row.id, error: error instanceof Error ? error.message.replace(/\s+/g, '_') : 'unknown' }))
  }
}

const ack = (outcome: string): Disposition => ({ disposition: 'ack', outcome })
const retry = (outcome: string, retryAfterSeconds: number): Disposition => ({ disposition: 'retry', retryAfterSeconds, outcome })
const line = (name: string, fields: Record<string, string | number | null | undefined>) =>
  `${name} ${Object.entries(fields).map(([k, v]) => `${k}=${v ?? ''}`).join(' ')}`.trim()

export async function processScanMessage(ctx: MessageContext, deps: ProcessDeps): Promise<Disposition> {
  const { store, config, now, log } = deps

  const parsed = parseScanResultMessage(ctx.body)
  if (!parsed.ok) {
    // Left in the queue on purpose: it ends in the dead-letter queue, which alarms, instead of vanishing.
    log(line('malware_scan_event_rejected', { reason: parsed.reason, detail: parsed.detail.replace(/\s+/g, '_') }))
    return retry(`rejected:${parsed.reason}`, 300)
  }
  const event = parsed.event
  if (event.bucket !== config.quarantineBucket || event.region !== config.region) {
    log(line('malware_scan_event_rejected', { reason: 'foreign-bucket-or-region', event: event.eventId }))
    return retry('rejected:foreign-bucket-or-region', 300)
  }
  if (event.key === GUARDDUTY_VALIDATION_KEY) return ack('ignored-validation-object')

  const row = await store.findByBinding({ bucket: event.bucket, key: event.key, versionId: event.versionId })
  const ageMs = now().getTime() - ctx.sentAt.getTime()
  if (!row) {
    // Either the upload's row is not committed yet, or this verdict is for an object the application no longer
    // tracks (a replaced upload, a removed draft, something put there by hand). Wait, then let it go with a trace.
    if (ageMs < UNKNOWN_OBJECT_GRACE_MS) return retry('row-not-visible', 30)
    log(line('malware_scan_unknown_object', { event: event.eventId, key: event.key, version: event.versionId }))
    return ack('unknown-object')
  }
  if (row.scanStatus !== 'pending') return ack(`duplicate:${row.scanStatus}`)

  const binding = row.quarantine!
  if (binding.etag && binding.etag !== event.etag) {
    log(line('malware_scan_binding_violation', { doc: row.id, event: event.eventId, why: 'etag-differs-from-upload' }))
    return reject(row, event, 'scan_error', 'ETAG_MISMATCH', ['verdict ETag differs from the uploaded object'], null, deps)
  }

  const decision = decideVerdict(event)
  if (decision.status !== 'clean') {
    const done = await store.decide(row.id, binding.versionId, {
      status: decision.status,
      result: decision.result,
      reasons: 'reasons' in decision ? decision.reasons : [],
      threat: 'threat' in decision ? decision.threat : null,
      eventId: event.eventId,
    })
    if (done) {
      const reasons = 'reasons' in decision ? decision.reasons : []
      log(line(decision.status === 'infected' ? 'malware_scan_infected' : 'malware_scan_rejected', { doc: row.id, app: row.applicationId, status: decision.status, result: decision.result, event: event.eventId }))
      await notifySafely(deps, row, decision.status, reasons)
    }
    return ack(`decided:${decision.status}`)
  }
  return promoteVerified(row, event, ctx, ageMs, deps)
}

async function reject(
  row: DocumentRow,
  event: ParsedScanEvent,
  status: RejectedStatus,
  result: string,
  reasons: string[],
  threat: string | null,
  deps: ProcessDeps,
): Promise<Disposition> {
  const done = await deps.store.decide(row.id, row.quarantine!.versionId, { status, result, reasons, threat, eventId: event.eventId })
  if (done) await notifySafely(deps, row, status, reasons)
  return ack(`decided:${status}:${result}`)
}

async function promoteVerified(row: DocumentRow, event: ParsedScanEvent, ctx: MessageContext, ageMs: number, deps: ProcessDeps): Promise<Disposition> {
  const { store, storage, log } = deps
  const q = row.quarantine!
  const ref: ObjectRef = { bucket: q.bucket, key: q.key, versionId: q.versionId }

  // 1. Corroborate with the object's own scan tag. Its absence is a delay; its contradiction is an error.
  let inspected: Awaited<ReturnType<ScanStorage['inspectQuarantine']>>
  try {
    inspected = await storage.inspectQuarantine(ref)
  } catch (error) {
    if (ageMs < TAG_GRACE_MS) {
      log(line('malware_scan_tag_pending', { doc: row.id, why: error instanceof StorageError ? error.kind : 'error' }))
      return retry('tag-not-readable', 30)
    }
    log(line('malware_scan_promotion_failed', { doc: row.id, why: 'tag-unreadable-after-grace' }))
    return reject(row, event, 'scan_error', 'TAG_UNREADABLE', ['the scan tag could not be read'], null, deps)
  }
  if (inspected.scanTag === null) {
    if (ageMs < TAG_GRACE_MS) return retry('tag-not-yet-present', 30)
    log(line('malware_scan_promotion_failed', { doc: row.id, why: 'tag-missing-after-grace' }))
    return reject(row, event, 'scan_error', 'TAG_MISSING', ['the scan tag never appeared'], null, deps)
  }
  if (inspected.scanTag !== 'NO_THREATS_FOUND') {
    log(line('malware_scan_binding_violation', { doc: row.id, event: event.eventId, why: 'tag-contradicts-event', tag: inspected.scanTag }))
    return reject(row, event, 'scan_error', 'TAG_CONFLICT', [`the object is tagged ${inspected.scanTag}`], null, deps)
  }

  // 2. The object that was scanned is the object that was uploaded.
  const sameObject =
    inspected.size === row.fileSize &&
    (q.etag === null || inspected.etag === q.etag) &&
    (row.sha256 === null || inspected.checksumSha256Hex === undefined || inspected.checksumSha256Hex === row.sha256)
  if (!sameObject) {
    log(line('malware_scan_binding_violation', { doc: row.id, event: event.eventId, why: 'object-differs-from-upload' }))
    return reject(row, event, 'scan_error', 'OBJECT_CHANGED', ['the scanned object differs from the upload'], null, deps)
  }
  if (!row.sha256) {
    // Only rows that pre-date screening lack a checksum, and they never have a quarantine binding. Not promotable.
    return reject(row, event, 'scan_error', 'NO_UPLOAD_CHECKSUM', ['no upload checksum was recorded'], null, deps)
  }

  // 3. Copy exactly that version into clean storage, proving the checksum.
  let cleanVersionId: string
  try {
    cleanVersionId = (
      await storage.promote({
        source: { ...ref, etag: q.etag ?? event.etag },
        cleanKey: row.storageKey,
        contentType: row.mimeType,
        sha256Hex: row.sha256,
      })
    ).cleanVersionId
  } catch (error) {
    const kind = error instanceof StorageError ? error.kind : 'transient'
    log(line('malware_scan_promotion_failed', { doc: row.id, kind, receive: ctx.receiveCount }))
    if (kind === 'mismatch') return reject(row, event, 'scan_error', 'PROMOTION_INTEGRITY', ['the clean copy failed its integrity check'], null, deps)
    if (ageMs < PROMOTION_GRACE_MS) return retry(`promotion-retry:${kind}`, 60)
    return reject(row, event, 'scan_error', 'PROMOTION_FAILED', ['the clean copy could not be written'], null, deps)
  }

  // 4. Record it, but only if the row is still this upload.
  const applied = await store.decide(row.id, q.versionId, {
    status: 'clean',
    result: 'NO_THREATS_FOUND',
    reasons: [],
    threat: null,
    eventId: event.eventId,
    cleanVersionId,
  })
  if (!applied) {
    // Lost a race: a duplicate delivery finished first, or the applicant replaced the file. If the row no longer
    // points at this key, the copy is an orphan and is withdrawn; if it does, the winner already recorded it.
    const current = await store.findById(row.id)
    if (!current || current.storageKey !== row.storageKey) await storage.deleteClean(row.storageKey).catch(() => undefined)
    return ack('lost-race')
  }

  // 5. The quarantine copy has done its job. Lifecycle removes it anyway if this fails.
  await storage.deleteQuarantineVersion(ref).catch(() => log(line('malware_scan_quarantine_cleanup_failed', { doc: row.id })))
  log(line('malware_scan_clean', { doc: row.id, app: row.applicationId, event: event.eventId }))
  return ack('decided:clean')
}

/**
 * Fails closed any document that has waited longer than the deadline for a verdict, and reports how many are waiting.
 * A late verdict for such a row is a no-op afterwards: the row is no longer pending.
 */
export async function sweepOverdue(deps: ProcessDeps): Promise<{ failed: number; waiting: number; oldestSeconds: number | null }> {
  const { store, config, now, log } = deps
  const cutoff = new Date(now().getTime() - config.verdictDeadlineMinutes * 60_000)
  let failed = 0
  for (const row of await store.listPendingBefore(cutoff, 50)) {
    const done = await store.decide(row.id, row.quarantine?.versionId ?? null, {
      status: 'scan_error',
      result: 'VERDICT_TIMEOUT',
      reasons: [`no verdict within ${config.verdictDeadlineMinutes} minutes`],
      threat: null,
      eventId: null,
    })
    if (done) {
      failed += 1
      log(line('malware_scan_timeout', { doc: row.id, app: row.applicationId, deadline_minutes: config.verdictDeadlineMinutes }))
      await notifySafely(deps, row, 'scan_error', ['VERDICT_TIMEOUT'])
    }
  }
  const summary = await store.pendingSummary()
  const oldestSeconds = summary.oldest ? Math.max(0, Math.round((now().getTime() - summary.oldest.getTime()) / 1000)) : null
  if (summary.count > 0 && oldestSeconds !== null && oldestSeconds > 10 * 60) {
    log(line('malware_scan_overdue', { waiting: summary.count, oldest_seconds: oldestSeconds }))
  }
  return { failed, waiting: summary.count, oldestSeconds }
}

