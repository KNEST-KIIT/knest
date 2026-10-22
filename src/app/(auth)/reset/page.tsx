import type { Metadata } from 'next'
import { turnstileSiteKey } from '@/server/security/turnstile'
import { ResetForm } from './reset-form'
import { safeNext } from '@/lib/safe-next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Reset your password' }

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return <ResetForm turnstileSiteKey={turnstileSiteKey()} next={safeNext(next)} />
}
