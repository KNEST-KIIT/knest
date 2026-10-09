import type { Metadata } from 'next'
import { Suspense } from 'react'
import { turnstileSiteKey } from '@/server/security/turnstile'
import { SignupForm } from './signup-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Start your journey' }

export default function SignupPage() {
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
  return (
    <Suspense>
      <SignupForm googleEnabled={googleEnabled} turnstileSiteKey={turnstileSiteKey()} />
    </Suspense>
  )
}
