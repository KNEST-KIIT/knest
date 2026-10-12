import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { isLabAttendanceQrEnabled } from '@/server/features'
import { limitByUser } from '@/server/security/route-limits'
import type { QrCode, QrResult } from './attendance-qr'

const STATUS_FOR_CODE: Record<QrCode, number> = { closed: 404, invalid: 400, 'not-found': 404, forbidden: 403, conflict: 409, limit: 409 }

const NO_STORE = { 'cache-control': 'no-store' }

export function respondQr<T extends object>(result: QrResult<T>, successStatus = 200): NextResponse {
  if (result.ok) return NextResponse.json(result, { status: successStatus, headers: NO_STORE })
  return NextResponse.json({ error: result.error, code: result.code }, { status: STATUS_FOR_CODE[result.code], headers: NO_STORE })
}

/**
 * Wraps a QR attendance route: while `FEATURE_LAB_ATTENDANCE_QR` (and lab booking) is off, every route
 * answers 404 as if it did not exist. Signed-in calls are rate limited per person.
 */
export async function qrRoute(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  if (!isLabAttendanceQrEnabled()) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE })
  try {
    const limited = await limitByUser('labScan')
    if (limited) return limited
    return await handler()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.status === 401 ? 'Sign in to continue.' : 'Not permitted.' }, { status: error.status, headers: NO_STORE })
    }
    throw error
  }
}

export const readJsonBody = (request: Request) => request.json().catch(() => null)
