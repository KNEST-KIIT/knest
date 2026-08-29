import type { Metadata } from 'next'
import { VerifyConfirm } from './verify-confirm'

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
        <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-title)] font-extrabold uppercase leading-tight">
          That link is invalid.
        </h1>
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
