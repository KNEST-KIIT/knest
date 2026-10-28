import { describe, expect, it } from 'vitest'
import { StorageError, type ObjectRef, type QuarantineUpload } from '@/server/storage/documents'
import {
  PROMOTION_GRACE_MS,
  processScanMessage,
  sweepOverdue,
  TAG_GRACE_MS,
  UNKNOWN_OBJECT_GRACE_MS,
  type Decision,
  type DocumentRow,
  type MessageContext,
  type ProcessDeps,
  type RejectedStatus,
  type ScanNotifier,
  type ScanStorage,
  type ScanStore,
} from './scan-processor'

const T0 = Date.parse('2026-10-27T10:00:00Z')
const BUCKET = 'knest-quarantine'
const SHA = 'a'.repeat(64)

const row = (over: Partial<DocumentRow> = {}): DocumentRow => ({
  id: 'doc-1',
  applicationId: 'app-1',
  userId: 'user-1',
  questionId: 'q-1',
  fileName: 'deck.pdf',
  storageKey: '2026-10-27/0123456789abcdef0123456789abcdef.pdf',
  mimeType: 'application/pdf',
  fileSize: 1234,
  sha256: SHA,
  scanStatus: 'pending',
  quarantine: { bucket: BUCKET, key: '2026-10-27/0123456789abcdef0123456789abcdef.pdf', versionId: 'ver-1', etag: 'etag-1' },
  uploadedAt: new Date(T0 - 60_000),
  ...over,
})

type Applied = { id: string; version: string | null; decision: Decision }
class FakeStore implements ScanStore {
  rows = new Map<string, DocumentRow>()
  applied: Applied[] = []
  /** Set to make the next decide() lose its compare-and-set, as if another worker or a replace got there first. */
  loseNextDecide = false
  /** What "someone else got there first" did to the row, applied at the moment the compare-and-set is lost. */
  whileLosing: (() => void) | null = null
  constructor(initial: DocumentRow[] = []) {
    for (const r of initial) this.rows.set(r.id, r)
  }
  // Like a database, hand out snapshots: what the caller holds does not change when the stored row does.
  private snapshot(r: DocumentRow | undefined): DocumentRow | null {
    return r ? { ...r, quarantine: r.quarantine ? { ...r.quarantine } : null } : null
  }
  async findByBinding(b: { bucket: string; key: string; versionId: string }) {
    return this.snapshot([...this.rows.values()].find((r) => r.quarantine && r.quarantine.bucket === b.bucket && r.quarantine.key === b.key && r.quarantine.versionId === b.versionId))
  }
  async findById(id: string) {
    return this.snapshot(this.rows.get(id))
  }
  async decide(id: string, version: string | null, decision: Decision) {
    const current = this.rows.get(id)
    if (this.loseNextDecide) {
      this.loseNextDecide = false
      this.whileLosing?.()
      return false
    }
    if (!current || current.scanStatus !== 'pending' || (current.quarantine?.versionId ?? null) !== version) return false
    current.scanStatus = decision.status
    this.applied.push({ id, version, decision })
    return true
  }
  async listPendingBefore(before: Date) {
    return [...this.rows.values()].filter((r) => r.scanStatus === 'pending' && r.uploadedAt < before)
  }
  async pendingSummary() {
    const pending = [...this.rows.values()].filter((r) => r.scanStatus === 'pending')
    return { count: pending.length, oldest: pending.length ? new Date(Math.min(...pending.map((r) => r.uploadedAt.getTime()))) : null }
  }
}

class FakeStorage implements ScanStorage {
  calls: string[] = []
  tag: string | null = 'NO_THREATS_FOUND'
  size: number | undefined = 1234
  etag: string | undefined = 'etag-1'
  checksum: string | undefined = SHA
  inspectError: StorageError | null = null
  promoteError: StorageError | null = null
  promoted: { source: QuarantineUpload; cleanKey: string; contentType: string; sha256Hex: string }[] = []
  deleted: ObjectRef[] = []
  deletedClean: string[] = []
  async inspectQuarantine(ref: ObjectRef) {
    this.calls.push(`inspect:${ref.versionId}`)
    if (this.inspectError) throw this.inspectError
    return this.tag === 'NO_THREATS_FOUND'
      ? { scanTag: this.tag, size: this.size, etag: this.etag, checksumSha256Hex: this.checksum }
      : { scanTag: this.tag }
  }
  async promote(input: { source: QuarantineUpload; cleanKey: string; contentType: string; sha256Hex: string }) {
    this.calls.push('promote')
    if (this.promoteError) throw this.promoteError
    this.promoted.push(input)
    return { cleanVersionId: 'clean-ver-1' }
  }
  async deleteQuarantineVersion(ref: ObjectRef) {
    this.calls.push('delete-quarantine')
    this.deleted.push(ref)
  }
  async deleteClean(key: string) {
    this.calls.push('delete-clean')
    this.deletedClean.push(key)
  }
}

class FakeNotifier implements ScanNotifier {
  sent: { id: string; status: RejectedStatus; reasons: string[] }[] = []
  failWith: Error | null = null
  async documentRejected(r: DocumentRow, status: RejectedStatus, reasons: string[]) {
    if (this.failWith) throw this.failWith
    this.sent.push({ id: r.id, status, reasons })
  }
}

function setup(rows: DocumentRow[] = [row()]) {
  const clock = { t: T0 }
  const logs: string[] = []
  const store = new FakeStore(rows)
  const storage = new FakeStorage()
  const notifier = new FakeNotifier()
  const deps: ProcessDeps = {
    store,
    storage,
    notifier,
    config: { quarantineBucket: BUCKET, region: 'ap-south-1', verdictDeadlineMinutes: 30 },
    now: () => new Date(clock.t),
    log: (l) => logs.push(l),
  }
  return { clock, logs, store, storage, notifier, deps }
}

const eventBody = (over: { bucket?: string; key?: string; versionId?: string; etag?: string; scanStatus?: string; result?: string; threats?: { name: string }[] | null; reasons?: string[] | null; region?: string; id?: string } = {}) =>
  JSON.stringify({
    version: '0',
    id: over.id ?? 'evt-1',
    'detail-type': 'GuardDuty Malware Protection Object Scan Result',
    source: 'aws.guardduty',
    account: '111122223333',
    time: '2026-10-27T10:00:30Z',
    region: over.region ?? 'ap-south-1',
    detail: {
      schemaVersion: '1.0',
      scanStatus: over.scanStatus ?? 'COMPLETED',
      resourceType: 'S3_OBJECT',
      s3ObjectDetails: {
        bucketName: over.bucket ?? BUCKET,
        objectKey: over.key ?? '2026-10-27/0123456789abcdef0123456789abcdef.pdf',
        eTag: over.etag ?? 'etag-1',
        versionId: over.versionId ?? 'ver-1',
        s3Throttled: false,
      },
      scanResultDetails: { scanResultStatus: over.result ?? 'NO_THREATS_FOUND', threats: over.threats ?? null, statusReasons: over.reasons ?? null },
    },
  })
const ctx = (body: string, ageMs = 5_000, receiveCount = 1): MessageContext => ({ body, sentAt: new Date(T0 - ageMs), receiveCount })

describe('a clean verdict', () => {
  it('promotes exactly the scanned version, records the evidence, removes the quarantine copy, acknowledges', async () => {
    const t = setup()
    const out = await processScanMessage(ctx(eventBody()), t.deps)
    expect(out).toEqual({ disposition: 'ack', outcome: 'decided:clean' })
    expect(t.storage.promoted).toEqual([
      {
        source: { bucket: BUCKET, key: '2026-10-27/0123456789abcdef0123456789abcdef.pdf', versionId: 'ver-1', etag: 'etag-1' },
        cleanKey: '2026-10-27/0123456789abcdef0123456789abcdef.pdf',
        contentType: 'application/pdf',
        sha256Hex: SHA,
      },
    ])
    expect(t.store.applied).toHaveLength(1)
    expect(t.store.applied[0]).toMatchObject({ id: 'doc-1', version: 'ver-1', decision: { status: 'clean', result: 'NO_THREATS_FOUND', eventId: 'evt-1', cleanVersionId: 'clean-ver-1' } })
    expect(t.storage.deleted).toEqual([{ bucket: BUCKET, key: '2026-10-27/0123456789abcdef0123456789abcdef.pdf', versionId: 'ver-1' }])
    expect(t.notifier.sent).toEqual([])
    // The order matters: tag checked, copy made, state recorded, only then the quarantine copy removed.
    expect(t.storage.calls).toEqual(['inspect:ver-1', 'promote', 'delete-quarantine'])
  })

  it('still counts as clean when the quarantine cleanup fails (the lifecycle rule is the backstop)', async () => {
    const t = setup()
    t.storage.deleteQuarantineVersion = async () => {
      throw new Error('boom')
    }
    const out = await processScanMessage(ctx(eventBody()), t.deps)
    expect(out.outcome).toBe('decided:clean')
    expect(t.store.rows.get('doc-1')!.scanStatus).toBe('clean')
    expect(t.logs.some((l) => l.startsWith('malware_scan_quarantine_cleanup_failed'))).toBe(true)
  })
})

describe('every non-clean verdict rejects, tells the applicant and promotes nothing', () => {
  it.each([
    ['THREATS_FOUND', 'COMPLETED', 'infected', [{ name: 'EICAR-Test-File (not a virus)' }], null],
    ['UNSUPPORTED', 'SKIPPED', 'unscannable', null, ['PASSWORD_PROTECTED']],
    ['ACCESS_DENIED', 'SKIPPED', 'scan_error', null, ['UNAUTHORIZED_TO_GET_OBJECT']],
    ['FAILED', 'FAILED', 'scan_error', null, null],
    ['BRAND_NEW_RESULT', 'COMPLETED', 'scan_error', null, null],
  ] as const)('%s on a %s scan ends as %s', async (result, scanStatus, status, threats, reasons) => {
    const t = setup()
    const out = await processScanMessage(ctx(eventBody({ result, scanStatus, threats: threats ? [...threats] : null, reasons: reasons ? [...reasons] : null })), t.deps)
    expect(out).toEqual({ disposition: 'ack', outcome: `decided:${status}` })
    expect(t.store.rows.get('doc-1')!.scanStatus).toBe(status)
    expect(t.storage.calls).toEqual([]) // no tag lookup, no copy, no deletion
    expect(t.notifier.sent).toHaveLength(1)
    expect(t.notifier.sent[0]).toMatchObject({ id: 'doc-1', status })
    expect(t.store.applied[0]!.decision.eventId).toBe('evt-1')
  })

  it('logs infections with the markers an alarm filters on, without the file name or the threat name', async () => {
    const t = setup()
    await processScanMessage(ctx(eventBody({ result: 'THREATS_FOUND', threats: [{ name: 'Secret Threat Name' }] })), t.deps)
    const line = t.logs.find((l) => l.startsWith('malware_scan_infected'))
    expect(line).toBeDefined()
    expect(line).not.toMatch(/Secret Threat Name|deck\.pdf/)
  })

  it('does not let a failing notifier undo or raise out of a recorded decision', async () => {
    const t = setup()
    t.notifier.failWith = new Error('mail is down')
    const out = await processScanMessage(ctx(eventBody({ result: 'THREATS_FOUND', threats: [{ name: 'x' }] })), t.deps)
    expect(out.outcome).toBe('decided:infected')
    expect(t.store.rows.get('doc-1')!.scanStatus).toBe('infected')
    expect(t.logs.some((l) => l.startsWith('malware_scan_notice_failed'))).toBe(true)
  })
})

describe('a verdict applies only to the exact object it names', () => {
  it('waits for a row it cannot see yet, then lets the message go with a trace', async () => {
    const t = setup([])
    expect(await processScanMessage(ctx(eventBody(), 1_000), t.deps)).toMatchObject({ disposition: 'retry', outcome: 'row-not-visible' })
    const late = await processScanMessage(ctx(eventBody(), UNKNOWN_OBJECT_GRACE_MS + 1), t.deps)
    expect(late).toEqual({ disposition: 'ack', outcome: 'unknown-object' })
    expect(t.logs.some((l) => l.startsWith('malware_scan_unknown_object'))).toBe(true)
    expect(t.storage.calls).toEqual([])
  })

  it.each([
    ['another version of the same key', { versionId: 'ver-OTHER' }],
    ['another key', { key: '2020-01-01/ffffffffffffffffffffffffffffffff.pdf' }],
  ])('does nothing for %s', async (_label, over) => {
    const t = setup()
    const out = await processScanMessage(ctx(eventBody(over), 1_000), t.deps)
    expect(out.disposition).toBe('retry')
    expect(t.store.rows.get('doc-1')!.scanStatus).toBe('pending')
    expect(t.storage.calls).toEqual([])
    expect(t.store.applied).toEqual([])
  })

  it('rejects an event for another bucket or region and leaves it for the dead-letter queue', async () => {
    for (const over of [{ bucket: 'someone-elses-bucket' }, { region: 'us-east-1' }]) {
      const t = setup()
      const out = await processScanMessage(ctx(eventBody(over)), t.deps)
      expect(out).toMatchObject({ disposition: 'retry', outcome: 'rejected:foreign-bucket-or-region' })
      expect(t.store.rows.get('doc-1')!.scanStatus).toBe('pending')
      expect(t.logs.some((l) => l.startsWith('malware_scan_event_rejected'))).toBe(true)
    }
  })

  it('fails the document closed when the verdict names a different ETag than the upload recorded', async () => {
    const t = setup()
    const out = await processScanMessage(ctx(eventBody({ etag: 'some-other-etag' })), t.deps)
    expect(out.outcome).toBe('decided:scan_error:ETAG_MISMATCH')
    expect(t.store.rows.get('doc-1')!.scanStatus).toBe('scan_error')
    expect(t.storage.calls).toEqual([])
    expect(t.notifier.sent).toHaveLength(1)
    expect(t.logs.some((l) => l.startsWith('malware_scan_binding_violation'))).toBe(true)
  })

  it('ignores the object GuardDuty writes to validate its own access', async () => {
    const t = setup()
    const out = await processScanMessage(ctx(eventBody({ key: 'malware-protection-resource-validation-object' })), t.deps)
    expect(out).toEqual({ disposition: 'ack', outcome: 'ignored-validation-object' })
  })
})

describe('replays and duplicates change nothing', () => {
  it.each(['clean', 'infected', 'unscannable', 'scan_error'] as const)('a row already %s is acknowledged untouched, whatever the new event says', async (state) => {
    for (const result of ['NO_THREATS_FOUND', 'THREATS_FOUND']) {
      const t = setup([row({ scanStatus: state })])
      const out = await processScanMessage(ctx(eventBody({ result, threats: result === 'THREATS_FOUND' ? [{ name: 'x' }] : null })), t.deps)
      expect(out).toEqual({ disposition: 'ack', outcome: `duplicate:${state}` })
      expect(t.storage.calls).toEqual([])
      expect(t.store.applied).toEqual([])
      expect(t.notifier.sent).toEqual([])
    }
  })

  it('treats a second delivery of the same clean event as a duplicate after the first completes', async () => {
    const t = setup()
    expect((await processScanMessage(ctx(eventBody()), t.deps)).outcome).toBe('decided:clean')
    expect((await processScanMessage(ctx(eventBody()), t.deps)).outcome).toBe('duplicate:clean')
    expect(t.storage.promoted).toHaveLength(1)
  })

  it('withdraws its copy when the row was replaced while it worked, and keeps it when a duplicate already won', async () => {
    const replaced = setup()
    replaced.store.loseNextDecide = true
    replaced.store.whileLosing = () => {
      // The applicant replaced the file while the copy was being made: the row now names a different upload.
      const stored = replaced.store.rows.get('doc-1')!
      stored.storageKey = '2026-10-27/ffffffffffffffffffffffffffffffff.pdf'
      stored.quarantine = { bucket: BUCKET, key: stored.storageKey, versionId: 'ver-2', etag: 'etag-2' }
    }
    const first = await processScanMessage(ctx(eventBody()), replaced.deps)
    expect(first.outcome).toBe('lost-race')
    expect(replaced.storage.deletedClean).toEqual(['2026-10-27/0123456789abcdef0123456789abcdef.pdf'])

    const won = setup()
    won.store.loseNextDecide = true
    won.store.whileLosing = () => {
      // A concurrent worker finished first: the row is clean and still points at this very key.
      won.store.rows.get('doc-1')!.scanStatus = 'clean'
    }
    const second = await processScanMessage(ctx(eventBody()), won.deps)
    expect(second.outcome).toBe('lost-race')
    expect(won.storage.deletedClean).toEqual([])
  })
})

describe('the object’s own scan tag must agree before anything is copied', () => {
  it('waits while the tag is absent, then fails closed once the grace period is over', async () => {
    const t = setup()
    t.storage.tag = null
    expect(await processScanMessage(ctx(eventBody(), 1_000), t.deps)).toMatchObject({ disposition: 'retry', outcome: 'tag-not-yet-present', retryAfterSeconds: 30 })
    expect(t.storage.promoted).toEqual([])
    expect(t.store.rows.get('doc-1')!.scanStatus).toBe('pending')
    const late = await processScanMessage(ctx(eventBody(), TAG_GRACE_MS + 1), t.deps)
    expect(late.outcome).toBe('decided:scan_error:TAG_MISSING')
    expect(t.store.rows.get('doc-1')!.scanStatus).toBe('scan_error')
  })

  it('waits while the tag cannot be read (the bucket policy hides it, or S3 hiccups), then fails closed', async () => {
    for (const kind of ['denied', 'not-found', 'transient'] as const) {
      const t = setup()
      t.storage.inspectError = new StorageError(kind, 'nope')
      expect((await processScanMessage(ctx(eventBody(), 1_000), t.deps)).disposition).toBe('retry')
      expect((await processScanMessage(ctx(eventBody(), TAG_GRACE_MS + 1), t.deps)).outcome).toBe('decided:scan_error:TAG_UNREADABLE')
      expect(t.storage.promoted).toEqual([])
    }
  })

  it.each(['THREATS_FOUND', 'UNSUPPORTED', 'FAILED', 'something-else'])('fails closed when the event says clean and the object is tagged %s', async (tag) => {
    const t = setup()
    t.storage.tag = tag
    const out = await processScanMessage(ctx(eventBody()), t.deps)
    expect(out.outcome).toBe('decided:scan_error:TAG_CONFLICT')
    expect(t.storage.promoted).toEqual([])
    expect(t.notifier.sent).toHaveLength(1)
    expect(t.logs.some((l) => l.startsWith('malware_scan_binding_violation'))).toBe(true)
  })

  it.each([
    ['a different size', (s: FakeStorage) => (s.size = 9999)],
    ['a different ETag', (s: FakeStorage) => (s.etag = 'changed')],
    ['a different checksum', (s: FakeStorage) => (s.checksum = 'b'.repeat(64))],
  ])('fails closed when the scanned object has %s than the upload', async (_label, mutate) => {
    const t = setup()
    mutate(t.storage)
    const out = await processScanMessage(ctx(eventBody()), t.deps)
    expect(out.outcome).toBe('decided:scan_error:OBJECT_CHANGED')
    expect(t.storage.promoted).toEqual([])
  })

  it('will not promote a row that has no upload checksum', async () => {
    const t = setup([row({ sha256: null })])
    const out = await processScanMessage(ctx(eventBody()), t.deps)
    expect(out.outcome).toBe('decided:scan_error:NO_UPLOAD_CHECKSUM')
    expect(t.storage.promoted).toEqual([])
  })
})

describe('promotion failures never become a success', () => {
  it('retries a transient failure, then fails closed after the grace period', async () => {
    const t = setup()
    t.storage.promoteError = new StorageError('transient', 'S3 is slow')
    expect(await processScanMessage(ctx(eventBody(), 1_000), t.deps)).toMatchObject({ disposition: 'retry', retryAfterSeconds: 60 })
    expect(t.store.rows.get('doc-1')!.scanStatus).toBe('pending')
    expect((await processScanMessage(ctx(eventBody(), PROMOTION_GRACE_MS + 1), t.deps)).outcome).toBe('decided:scan_error:PROMOTION_FAILED')
    expect(t.logs.filter((l) => l.startsWith('malware_scan_promotion_failed'))).toHaveLength(2)
  })

  it('fails closed at once when the copy fails its integrity check', async () => {
    const t = setup()
    t.storage.promoteError = new StorageError('mismatch', 'checksum differs')
    expect((await processScanMessage(ctx(eventBody()), t.deps)).outcome).toBe('decided:scan_error:PROMOTION_INTEGRITY')
    expect(t.notifier.sent).toHaveLength(1)
  })

  it('does not delete the quarantine copy unless the clean state was recorded', async () => {
    const t = setup()
    t.store.loseNextDecide = true
    await processScanMessage(ctx(eventBody()), t.deps)
    expect(t.storage.deleted).toEqual([])
  })
})

describe('events that are not usable are never acknowledged', () => {
  it.each([
    ['not JSON', 'definitely not json'],
    ['another detail type', eventBody().replace('Object Scan Result', 'Resource Status Error')],
    ['an empty detail', JSON.stringify({ source: 'aws.guardduty', 'detail-type': 'GuardDuty Malware Protection Object Scan Result', detail: {} })],
  ])('hands back %s for the dead-letter queue', async (_label, body) => {
    const t = setup()
    const out = await processScanMessage(ctx(body), t.deps)
    expect(out.disposition).toBe('retry')
    expect(out.retryAfterSeconds).toBe(300)
    expect(t.store.applied).toEqual([])
    expect(t.logs.some((l) => l.startsWith('malware_scan_event_rejected'))).toBe(true)
  })
})

describe('the overdue sweep', () => {
  it('fails closed any file that has waited longer than the deadline, and only those', async () => {
    const old = row({ id: 'old', uploadedAt: new Date(T0 - 31 * 60_000), quarantine: { bucket: BUCKET, key: 'k-old', versionId: 'v-old', etag: 'e' } })
    const fresh = row({ id: 'fresh', uploadedAt: new Date(T0 - 5 * 60_000), quarantine: { bucket: BUCKET, key: 'k-fresh', versionId: 'v-fresh', etag: 'e' } })
    const t = setup([old, fresh])
    const out = await sweepOverdue(t.deps)
    expect(out.failed).toBe(1)
    expect(out.waiting).toBe(1)
    expect(t.store.rows.get('old')!.scanStatus).toBe('scan_error')
    expect(t.store.rows.get('fresh')!.scanStatus).toBe('pending')
    expect(t.store.applied[0]!.decision).toMatchObject({ status: 'scan_error', result: 'VERDICT_TIMEOUT', eventId: null })
    expect(t.notifier.sent).toEqual([{ id: 'old', status: 'scan_error', reasons: ['VERDICT_TIMEOUT'] }])
    expect(t.logs.some((l) => l.startsWith('malware_scan_timeout'))).toBe(true)
  })

  it('makes a late clean verdict for a timed-out file a no-op', async () => {
    const t = setup([row({ uploadedAt: new Date(T0 - 40 * 60_000) })])
    await sweepOverdue(t.deps)
    const late = await processScanMessage(ctx(eventBody(), 41 * 60_000), t.deps)
    expect(late.outcome).toBe('duplicate:scan_error')
    expect(t.storage.promoted).toEqual([])
  })

  it('reports files that have been waiting a long time, before the deadline, so an alarm can fire', async () => {
    const t = setup([row({ uploadedAt: new Date(T0 - 12 * 60_000) })])
    const out = await sweepOverdue(t.deps)
    expect(out.failed).toBe(0)
    expect(out.oldestSeconds).toBe(720)
    expect(t.logs.some((l) => l.startsWith('malware_scan_overdue'))).toBe(true)
  })

  it('says nothing when nothing is waiting', async () => {
    const t = setup([row({ scanStatus: 'clean' })])
    expect(await sweepOverdue(t.deps)).toEqual({ failed: 0, waiting: 0, oldestSeconds: null })
    expect(t.logs).toEqual([])
  })
})
