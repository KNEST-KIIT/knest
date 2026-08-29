import { NextResponse } from 'next/server'
import { confirmEmailVerification } from '@/server/auth/actions'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const result = await confirmEmailVerification(body?.email, body?.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
