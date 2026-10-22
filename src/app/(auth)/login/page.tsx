import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { safeNext } from '@/lib/safe-next'
import { googleConfigured } from '@/server/auth/providers'
import { turnstileSiteKey } from '@/server/security/turnstile'
import { LoginForm } from './login-form'

// Read at request time (the Google flag and the Turnstile key), never baked into the build.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Log in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const googleEnabled = googleConfigured()
  let recoveryNext: string | null = null
  if ((await searchParams).error) {
    const store = await cookies()
    const callback = store.get('authjs.callback-url')?.value ?? store.get('__Secure-authjs.callback-url')?.value
    try {
      const base = process.env.AUTH_URL ?? process.env.SITE_URL
      if (base && callback) {
        const target = new URL(callback, base)
        if (target.origin === new URL(base).origin && !['/auth/complete', '/login', '/signup'].includes(target.pathname)) {
          recoveryNext = safeNext(target.pathname + target.search + target.hash)
        }
      }
    } catch { /* A malformed cookie never determines a redirect. */ }
  }
  return (
    <Suspense>
      <LoginForm googleEnabled={googleEnabled} turnstileSiteKey={turnstileSiteKey()} recoveryNext={recoveryNext} />
    </Suspense>
  )
}
