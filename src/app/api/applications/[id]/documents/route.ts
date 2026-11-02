import { unexpectedError } from '@/server/http/errors'
import { NextResponse } from 'next/server'
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import { uploadDocument } from '@/server/applications/actions'
import { MAX_UPLOAD_BYTES } from '@/server/applications/validation'
import { RateLimitError } from '@/server/security/rate-limit'

/** Boundaries and field headers around the file inside a multipart body. */
const MULTIPART_OVERHEAD_BYTES = 256 * 1024

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Nothing is read from the body until we know who is sending it and that it is a size we accept.
  // formData() buffers the whole request, so an anonymous or oversized one must be turned away first.
  try {
    await requireUserOrThrow()
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    return unexpectedError(error)
  }
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ error: 'That file is over 10 MB. Try compressing it.' }, { status: 413 })
  }

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
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }
    return unexpectedError(error)
  }
}
