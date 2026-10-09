import type { Metadata } from 'next'
import { Suspense } from 'react'
import { turnstileSiteKey } from '@/server/security/turnstile'
import { LoginForm } from './login-form'

// Read at request time (the Google flag and the Turnstile key), never baked into the build.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Log in' }

export default function LoginPage() {
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
  return (
    <Suspense>
      <LoginForm googleEnabled={googleEnabled} turnstileSiteKey={turnstileSiteKey()} />
    </Suspense>
  )
}
