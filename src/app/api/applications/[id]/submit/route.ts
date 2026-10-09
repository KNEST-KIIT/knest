import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { submitApplication } from '@/server/applications/actions'
import { captchaFailure } from '@/server/security/captcha'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const captcha = await captchaFailure(request, body)
  if (captcha) return captcha

  try {
    const result = await submitApplication(id)
    if (!result.ok) {
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
