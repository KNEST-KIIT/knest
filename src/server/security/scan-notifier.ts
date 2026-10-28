import { db } from '@/db/client'
import { sendNotificationEmail, writeNotification } from '@/server/notifications/send'
import { documentScreeningFailedTemplate } from '@/server/notifications/templates'
import { applicantMessage } from './scan-verdict'
import type { DocumentRow, RejectedStatus, ScanNotifier } from './scan-processor'

/**
 * Tells the applicant, in plain words, that a file did not make it through screening. The in-app notice is
 * best-effort and the e-mail never throws (sendNotificationEmail); neither can undo or delay the decision, which
 * is already recorded by the time this runs. No threat name, bucket or internal code ever reaches the applicant.
 */
export const dbScanNotifier: ScanNotifier = {
  async documentRejected(row: DocumentRow, status: RejectedStatus, reasons: string[]) {
    const message = applicantMessage(status, reasons)
    const email = documentScreeningFailedTemplate({ fileName: row.fileName, message, applicationId: row.applicationId })
    try {
      await writeNotification(db, {
        userId: row.userId,
        type: 'document_screening_failed',
        title: 'A file did not pass the security check',
        body: `${row.fileName}: ${message}`,
        href: `/dashboard/applications/${row.applicationId}`,
        applicationId: row.applicationId,
        email,
      })
    } catch (error) {
      console.error('malware_scan_notice_failed', error instanceof Error ? error.message : String(error))
    }
    await sendNotificationEmail(row.userId, email)
  },
}
