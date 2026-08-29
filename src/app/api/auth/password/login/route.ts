import { NextResponse } from 'next/server'
import { loginWithPassword } from '@/server/auth/actions'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const result = await loginWithPassword(body)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
