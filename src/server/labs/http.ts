import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/server/auth/guards'
import { isLabBookingEnabled } from '@/server/features'
import type { Result } from './service'

const STATUS_FOR_CODE = { closed: 404, ineligible: 403, invalid: 400, limit: 409, conflict: 409, 'not-found': 404, state: 409, forbidden: 403 } as const

/** Turns a service result into a JSON response. Failures carry a readable `error` and a stable `code`. */
export function respond<T extends object>(result: Result<T>, successStatus = 200): NextResponse {
  if (result.ok) return NextResponse.json(result, { status: successStatus })
  return NextResponse.json({ error: result.error, code: result.code }, { status: STATUS_FOR_CODE[result.code] })
}

/**
 * Wraps a lab route: refuses everything with 404 while the feature is off (the routes do not
 * exist as far as a caller can tell), and maps a failed sign-in or permission check to its status.
 */
export async function labRoute(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  if (!isLabBookingEnabled()) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  try {
    return await handler()
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.status === 401 ? 'Sign in to continue.' : 'Not permitted.' }, { status: error.status })
    }
    throw error
  }
}

export const readJson = (request: Request) => request.json().catch(() => null)
