import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { setMemberActive } from '@/server/members/directory'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const isActive = body?.isActive

  // Strictly boolean: a truthy string would silently reactivate an account
  // someone meant to switch off.
  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'Say whether the account is active.' }, { status: 400 })
  }

  try {
    const result = await setMemberActive(id, isActive)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}
