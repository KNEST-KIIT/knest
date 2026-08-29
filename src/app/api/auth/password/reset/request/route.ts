import { NextResponse } from 'next/server'
import { requestPasswordReset } from '@/server/auth/actions'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const result = await requestPasswordReset(body?.email)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
