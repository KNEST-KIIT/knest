import type { Metadata } from 'next'
import { Suspense } from 'react'
import { googleConfigured } from '@/server/auth/providers'
import { turnstileSiteKey } from '@/server/security/turnstile'
import { SignupForm } from './signup-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Start your journey' }

export default function SignupPage() {
  const googleEnabled = googleConfigured()
  return (
    <Suspense>
      <SignupForm googleEnabled={googleEnabled} turnstileSiteKey={turnstileSiteKey()} />
    </Suspense>
  )
}
