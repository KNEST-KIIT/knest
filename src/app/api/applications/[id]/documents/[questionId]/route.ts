import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { applicationDocuments, applications } from '@/db/schema'
import { removeDocument } from '@/server/applications/actions'
import { serveDocument } from '@/server/applications/document-response'
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import { limitByUser } from '@/server/security/route-limits'

/**
 * The owner may check their attachment before or after submission. Staff use the audited staff route.
 * A file is served only once it has passed malware screening: 423 while it is still being checked, 404 if it was rejected.
 */
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
    return await serveDocument(row.document)
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    throw error
  }
}

/** The owner takes a file off their draft, whatever its screening state. Submitted applications are frozen. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  try {
    const limited = await limitByUser('fileUpload')
    if (limited) return limited
    const { id, questionId } = await params
    const result = await removeDocument(id, questionId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    throw error
  }
}
