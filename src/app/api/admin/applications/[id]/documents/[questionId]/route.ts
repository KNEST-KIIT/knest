import { and, eq, ne } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { applicationDocuments, applications, auditLogs } from '@/db/schema'
import { requireStaffOrThrow, UnauthorizedError } from '@/server/auth/guards'
import { limitByUser } from '@/server/security/route-limits'
import { getFile } from '@/server/storage'

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

  const buffer = await getFile(document.storageKey)

  // An applicant's document is personal data: who opened it, and when, belongs in the trail.
  await db.insert(auditLogs).values({
    actorUserId: actorId,
    action: 'application_document_viewed',
    entityType: 'application',
    entityId: id,
    before: null,
    after: { questionId, documentId: document.id },
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': document.mimeType,
      // The stored name is whatever the uploader's browser sent. Quotes, line
      // breaks and non-ASCII characters in a header value throw or split the
      // header, so the plain name is reduced to safe ASCII and the real name is
      // offered separately in the RFC 5987 form.
      'Content-Disposition': `attachment; filename="${document.fileName.replace(/[^\w. -]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      'Content-Length': String(document.fileSize),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
