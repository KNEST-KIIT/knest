import { NextResponse } from 'next/server'
import { resetPassword } from '@/server/auth/actions'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const result = await resetPassword(body?.email, body?.token, body?.password)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
