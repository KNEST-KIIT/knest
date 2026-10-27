import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { limitByUser } from '@/server/security/route-limits'
import { changeApplicationStatus } from '@/server/applications/review'
import { staffStatusChangeSchema } from '@/server/applications/validation'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await limitByUser('staffAction')
  if (limited) return limited
  const { id } = await params
  const rawBody = await request.json().catch(() => null)

  const parsed = staffStatusChangeSchema.safeParse(rawBody)
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message ?? 'Invalid status change request.'
    return NextResponse.json({ error }, { status: 400 })
  }

  const { status, note } = parsed.data

  try {
    const result = await changeApplicationStatus(id, status, note ?? undefined)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code === 'conflict' ? 409 : 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}
