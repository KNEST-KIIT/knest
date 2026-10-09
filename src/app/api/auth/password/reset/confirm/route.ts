import { NextResponse } from 'next/server'
import { resetPassword } from '@/server/auth/actions'
import { limitByIp } from '@/server/security/route-limits'

export async function POST(request: Request) {
  const limited = await limitByIp(request, 'tokenConfirm')
  if (limited) return limited
  const body = await request.json().catch(() => null)
  const result = await resetPassword(body?.email, body?.token, body?.password)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
