import type { Metadata } from 'next'
import { VerifyConfirm } from './verify-confirm'
import { Heading } from '@/components/ui'

export const metadata: Metadata = { title: 'Confirm your email' }

export default async function VerifyConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>
}) {
  const { email, token } = await searchParams

  if (!email || !token) {
    return (
      <div>
        <Heading as="h1" size="title">
          That link is invalid.
        </Heading>
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          <a href="/verify" className="font-medium text-[var(--color-signal)]">
            Request a new one.
          </a>
        </p>
      </div>
    )
  }

  return <VerifyConfirm email={email} token={token} />
}
