import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { isStaffRoleOrNull, setStaffRole } from '@/server/members/actions'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const role = body?.staffRole

  // null clears staff access; anything else must be a real role. An unchecked
  // string would reach the enum column and come back as a 500.
  if (!isStaffRoleOrNull(role)) {
    return NextResponse.json({ error: 'That isn’t a staff role.' }, { status: 400 })
  }

  try {
    const result = await setStaffRole(id, role)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}
