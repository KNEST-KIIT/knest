import { NextResponse } from 'next/server'
import { getDocumentScanStatus } from '@/server/applications/actions'
import { UnauthorizedError } from '@/server/auth/guards'
import { limitByUser } from '@/server/security/route-limits'

/** Is my file checked yet? Owner only. Words and a state; never a bucket, version, checksum or threat name. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  try {
    const limited = await limitByUser('documentStatus')
    if (limited) return limited
    const { id, questionId } = await params
    const status = await getDocumentScanStatus(id, questionId)
    if (!status) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    return NextResponse.json(status, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.status === 401 ? 'Sign in to continue.' : 'Not found.' }, { status: error.status === 401 ? 401 : 404 })
    throw error
  }
}
