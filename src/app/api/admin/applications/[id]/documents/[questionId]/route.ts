import { and, eq, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { applicationDocuments, applications, auditLogs } from '@/db/schema'
import { serveDocument } from '@/server/applications/document-response'
import { requireStaffOrThrow, UnauthorizedError } from '@/server/auth/guards'
import { limitByUser } from '@/server/security/route-limits'

/**
 * Staff download of an applicant's file. Served only from clean storage and only for a file that has passed malware
 * screening; a submitted application can only hold such files, so 423 or 404 here means a file was withdrawn or is
 * still being checked. Opening a file is recorded, once, when it is actually served.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const limited = await limitByUser('staffAction')
  if (limited) return limited
  const { id, questionId } = await params

  let actorId: string
  try {
    actorId = (await requireStaffOrThrow('applications')).id
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }

  const application = await db.query.applications.findFirst({
    where: and(eq(applications.id, id), ne(applications.status, 'draft')),
    columns: { id: true },
  })
  if (!application) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const document = await db.query.applicationDocuments.findFirst({
    where: and(eq(applicationDocuments.applicationId, id), eq(applicationDocuments.questionId, questionId)),
  })
  if (!document) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  return serveDocument(document, {
    // An applicant's document is personal data: who opened it, and when, belongs in the trail.
    afterRead: async () => {
      await db.insert(auditLogs).values({
        actorUserId: actorId,
        action: 'application_document_viewed',
        entityType: 'application',
        entityId: id,
        before: null,
        after: { questionId, documentId: document.id },
      })
    },
  })
}
