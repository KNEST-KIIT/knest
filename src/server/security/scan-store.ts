import { and, asc, count, eq, isNull, lt, min } from 'drizzle-orm'
import { db } from '@/db/client'
import { applicationDocuments, applications } from '@/db/schema'
import type { Decision, DocumentRow, ScanStore } from './scan-processor'

/** The database side of document screening: the only code that moves a document out of `pending`. */

type Joined = { doc: typeof applicationDocuments.$inferSelect; userId: string }

function toRow({ doc, userId }: Joined): DocumentRow {
  return {
    id: doc.id,
    applicationId: doc.applicationId,
    userId,
    questionId: doc.questionId,
    fileName: doc.fileName,
    storageKey: doc.storageKey,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    sha256: doc.sha256,
    scanStatus: doc.scanStatus,
    quarantine:
      doc.quarantineBucket && doc.quarantineKey && doc.quarantineVersionId
        ? { bucket: doc.quarantineBucket, key: doc.quarantineKey, versionId: doc.quarantineVersionId, etag: doc.quarantineEtag }
        : null,
    uploadedAt: doc.uploadedAt,
  }
}

const joined = () =>
  db.select({ doc: applicationDocuments, userId: applications.userId }).from(applicationDocuments).innerJoin(applications, eq(applicationDocuments.applicationId, applications.id))

export const dbScanStore: ScanStore = {
  async findByBinding({ bucket, key, versionId }) {
    const [found] = await joined()
      .where(
        and(
          eq(applicationDocuments.quarantineBucket, bucket),
          eq(applicationDocuments.quarantineKey, key),
          eq(applicationDocuments.quarantineVersionId, versionId),
        ),
      )
      .limit(1)
    return found ? toRow(found) : null
  },

  async findById(id) {
    const [found] = await joined().where(eq(applicationDocuments.id, id)).limit(1)
    return found ? toRow(found) : null
  },

  /**
   * The single write path out of `pending`. The WHERE clause is the guarantee: the row must still be pending and
   * still bound to the quarantine version the verdict was matched to, so a replay, a duplicate, a replaced upload or
   * a second worker updates nothing and gets `false` back.
   */
  async decide(id, quarantineVersionId, decision: Decision) {
    const updated = await db
      .update(applicationDocuments)
      .set({
        scanStatus: decision.status,
        scanResult: decision.result,
        scanReasons: decision.reasons,
        scanThreat: decision.threat,
        scanEventId: decision.eventId,
        scanDecidedAt: new Date(),
        cleanVersionId: decision.status === 'clean' ? decision.cleanVersionId : null,
      })
      .where(
        and(
          eq(applicationDocuments.id, id),
          eq(applicationDocuments.scanStatus, 'pending'),
          quarantineVersionId === null ? isNull(applicationDocuments.quarantineVersionId) : eq(applicationDocuments.quarantineVersionId, quarantineVersionId),
        ),
      )
      .returning({ id: applicationDocuments.id })
    return updated.length === 1
  },

  async listPendingBefore(before, limit) {
    const rows = await joined()
      .where(and(eq(applicationDocuments.scanStatus, 'pending'), lt(applicationDocuments.uploadedAt, before)))
      .orderBy(asc(applicationDocuments.uploadedAt))
      .limit(limit)
    return rows.map(toRow)
  },

  async pendingSummary() {
    const [row] = await db
      .select({ count: count(), oldest: min(applicationDocuments.uploadedAt) })
      .from(applicationDocuments)
      .where(eq(applicationDocuments.scanStatus, 'pending'))
    return { count: row?.count ?? 0, oldest: row?.oldest ?? null }
  },
}
