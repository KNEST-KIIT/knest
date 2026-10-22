import type { Metadata } from 'next'
import { ResetConfirmForm } from './reset-confirm-form'
import { Heading } from '@/components/ui'
import { safeNext } from '@/lib/safe-next'

export const metadata: Metadata = { title: 'Set a new password' }

export default async function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string; next?: string }>
}) {
  const { email, token, next } = await searchParams

  if (!email || !token) {
    return (
      <div>
        <Heading as="h1" size="title">
          That link is invalid.
        </Heading>
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          It may have expired, or the address may be wrong.{' '}
          <a href="/reset" className="font-medium text-[var(--color-signal)]">
            Request a new one.
          </a>
        </p>
      </div>
    )
  }

  return <ResetConfirmForm email={email} token={token} next={safeNext(next)} />
}
