import { NextResponse } from 'next/server'
import { sendVerificationEmail } from '@/server/auth/actions'
import { limitByIp } from '@/server/security/route-limits'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  // Per connection, and per address so one mailbox cannot be flooded from many connections.
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  const limited = (await limitByIp(request, 'verifySend')) ?? (await limitByIp(request, 'verifySend', email))
  if (limited) return limited
  const result = await sendVerificationEmail(body?.email)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
