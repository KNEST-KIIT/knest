import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { submitApplication } from '@/server/applications/actions'
import { captchaFailure } from '@/server/security/captcha'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const captcha = await captchaFailure(request, body, 'application-submit')
  if (captcha) return captcha

  try {
    const result = await submitApplication(id)
    if (!result.ok) {
      // 423: a file is still waiting for its malware check, so try again shortly. 422: a file was rejected and must be replaced.
      if (result.code === 'scan-pending') {
        return NextResponse.json({ error: result.error, code: result.code }, { status: 423, headers: { 'Retry-After': '30' } })
      }
      if (result.code === 'scan-blocked') return NextResponse.json({ error: result.error, code: result.code }, { status: 422 })
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.status })
    }
    throw error
  }
}
