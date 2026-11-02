import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'

/**
 * The one answer for an error a route did not expect. Without it Next sends an HTML 500 page, which a
 * `fetch(...).json()` caller cannot read, so the form says nothing useful. Here a caller always gets
 * JSON, and a database that is unreachable, saturated or slow is reported as 503 (try again) rather
 * than as a bug (500).
 */

const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
  '08000',
  '08001',
  '08003',
  '08006',
  '57014', // query_canceled (statement timeout)
])

export function isTemporaryFailure(error: unknown): boolean {
  const e = error as { code?: unknown; cause?: unknown; message?: unknown } | null
  if (!e || typeof e !== 'object') return false
  if (typeof e.code === 'string' && UNAVAILABLE_CODES.has(e.code)) return true
  // Password hashing is queued one at a time and refuses past a limit (src/server/auth/password-work.ts).
  if ((error as { name?: unknown }).name === 'PasswordBusyError') return true
  if (typeof e.message === 'string' && /timeout exceeded when trying to connect|Connection terminated|timed out/i.test(e.message)) return true
  return e.cause !== undefined && e.cause !== error ? isTemporaryFailure(e.cause) : false
}

/** Returns a JSON response for an unexpected error. Next's own redirect and not-found signals pass through. */
export function unexpectedError(error: unknown): NextResponse {
  unstable_rethrow(error)
  const temporary = isTemporaryFailure(error)
  console.error(temporary ? '[api] temporary failure' : '[api] unexpected error', error)
  return NextResponse.json(
    { error: temporary ? 'The service is busy. Try again in a moment.' : 'Something went wrong on our end. Try again in a moment.', code: temporary ? 'unavailable' : 'server-error' },
    { status: temporary ? 503 : 500, headers: temporary ? { 'retry-after': '5', 'cache-control': 'no-store' } : { 'cache-control': 'no-store' } },
  )
}
