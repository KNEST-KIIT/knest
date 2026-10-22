import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { applicationDocuments, applications } from '@/db/schema'
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import { limitByUser } from '@/server/security/route-limits'
import { getFile } from '@/server/storage'

/** The owner may check their attachment before or after submission. Staff use the audited staff route. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  try {
    const user = await requireUserOrThrow()
    const limited = await limitByUser('fileDownload')
    if (limited) return limited
    const { id, questionId } = await params
    const [row] = await db.select({ document: applicationDocuments }).from(applicationDocuments)
      .innerJoin(applications, eq(applicationDocuments.applicationId, applications.id))
      .where(and(eq(applications.id, id), eq(applications.userId, user.id), eq(applicationDocuments.questionId, questionId))).limit(1)
    if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    const document = row.document
    const buffer = await getFile(document.storageKey)
    return new NextResponse(new Uint8Array(buffer), { headers: {
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${document.fileName.replace(/[^\w. -]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      'Content-Length': String(document.fileSize),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    } })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    throw error
  }
}
