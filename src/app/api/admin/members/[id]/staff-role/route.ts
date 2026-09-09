import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { setStaffRole } from '@/server/members/directory'
import type { StaffRole } from '@/server/auth/roles'

const VALID: readonly string[] = [
  'reviewer',
  'content_admin',
  'program_manager',
  'startup_manager',
  'mentor_manager',
  'super_admin',
]

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const raw = body?.staffRole

  // Null clears staff access; anything else must be a real role. An unchecked
  // string here would write a value the enum rejects at the database, as a 500.
  if (raw !== null && !VALID.includes(raw)) {
    return NextResponse.json({ error: 'That isn’t a staff role.' }, { status: 400 })
  }

  try {
    const result = await setStaffRole(id, (raw as StaffRole | null) ?? null)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}
