import type { Metadata } from 'next'
import { turnstileSiteKey } from '@/server/security/turnstile'
import { ResetForm } from './reset-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Reset your password' }

export default function ResetPage() {
  return <ResetForm turnstileSiteKey={turnstileSiteKey()} />
}
