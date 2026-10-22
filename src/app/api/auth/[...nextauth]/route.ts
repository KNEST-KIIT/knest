import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/server/auth'

export async function GET(request: NextRequest) {
  // Browsers discard these short-lived cookies when a sign-in is left open.
  // Explain how to restart instead of exposing Auth.js's generic callback error.
  // Present cookies still go through Auth.js's full state and PKCE validation.
  if (request.nextUrl.pathname === '/api/auth/callback/google' && request.nextUrl.searchParams.has('code')) {
    // Match Auth.js's configured public origin behind an HTTPS reverse proxy.
    const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? request.url
    const prefix = new URL(authUrl).protocol === 'https:' ? '__Secure-' : ''
    if (!request.cookies.get(`${prefix}authjs.state`)?.value || !request.cookies.get(`${prefix}authjs.pkce.code_verifier`)?.value) {
      return NextResponse.redirect(new URL('/login?error=GoogleSessionExpired', request.url), 303)
    }
  }
  return handlers.GET(request)
}

export const POST = handlers.POST
