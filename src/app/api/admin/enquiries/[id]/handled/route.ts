import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { markEnquiryHandled } from '@/server/enquiries/actions'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const result = await markEnquiryHandled(id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}
