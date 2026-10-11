import { NextResponse } from 'next/server'
import { signIn } from '@/server/auth'
import { googleConfigured } from '@/server/auth/providers'
import { safeNext } from '@/lib/safe-next'
import { limitByIp } from '@/server/security/route-limits'

/**
 * Begins Google sign-in. Auth.js starts the OAuth exchange only on a POST, so the Google
 * button on /login and /signup posts here and this hands off to the server-side signIn,
 * which sets the state and PKCE cookies and gives back Google's authorisation URL.
 *
 * The return path is validated with safeNext; anything else falls back to /dashboard,
 * which sends a new account on to onboarding.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin
  // A separate bucket from password sign-in, so starting Google never spends password attempts.
  if (await limitByIp(request, 'login', 'google')) {
    return NextResponse.redirect(new URL('/login?error=TooManyAttempts', origin), 303)
  }
  const failure = () => NextResponse.redirect(new URL('/login?error=GoogleUnavailable', origin), 303)
  if (!googleConfigured()) return failure()

  const form = await request.formData().catch(() => null)
  const next = safeNext(typeof form?.get('next') === 'string' ? (form.get('next') as string) : null)

  try {
    const url = await signIn('google', { redirectTo: next ?? '/dashboard', redirect: false })
    if (typeof url !== 'string') return failure()
    // 303 so the browser follows with a GET; a 307 would re-send the POST to Google.
    return NextResponse.redirect(url, 303)
  } catch (error) {
    console.error('google_signin_start_failed', error instanceof Error ? error.name : 'unknown')
    return failure()
  }
}
