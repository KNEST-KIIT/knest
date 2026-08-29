import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { uploadDocument } from '@/server/applications/actions'
import { MAX_UPLOAD_BYTES } from '@/server/applications/validation'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const questionId = form?.get('questionId')

  if (!(file instanceof File) || typeof questionId !== 'string') {
    return NextResponse.json({ error: 'Missing file or question.' }, { status: 400 })
  }
  // Reject oversized uploads before reading the body into memory, not only
  // after — arrayBuffer() below would otherwise buffer the whole file first.
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'That file is over 10 MB. Try compressing it.' }, { status: 413 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadDocument(id, questionId, {
      name: file.name,
      type: file.type,
      size: file.size,
      buffer,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
