import { NextResponse } from 'next/server'
import { unexpectedError } from '@/server/http/errors'
import { confirmEmailVerification } from '@/server/auth/actions'
import { limitByIp } from '@/server/security/route-limits'

export async function POST(request: Request) {
  const limited = await limitByIp(request, 'tokenConfirm')
  if (limited) return limited
  const body = await request.json().catch(() => null)
  let result: Awaited<ReturnType<typeof confirmEmailVerification>>
  try {
    result = await confirmEmailVerification(body?.email, body?.token, body?.password)
  } catch (error) {
    return unexpectedError(error)
  }
  if (!result.ok) {
    const status = 'serverError' in result && result.serverError ? 500 : 400
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ ok: true })
}
