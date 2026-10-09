import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { guardRequest } from '@/server/security/edge-guard'

export function proxy(request: NextRequest) {
  const decision = guardRequest(
    { method: request.method, pathname: request.nextUrl.pathname, header: (name) => request.headers.get(name) },
    process.env,
  )
  if (!decision.allow) {
    return new NextResponse('Forbidden', { status: decision.status, headers: { 'cache-control': 'no-store' } })
  }
  return NextResponse.next()
}

export const config = { matcher: '/:path*' }
