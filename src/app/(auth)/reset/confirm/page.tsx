import type { Metadata } from 'next'
import { ResetConfirmForm } from './reset-confirm-form'

export const metadata: Metadata = { title: 'Set a new password' }

export default async function ResetConfirmPage({
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
          It may have expired, or the address may be wrong.{' '}
          <a href="/reset" className="font-medium text-[var(--color-signal)]">
            Request a new one.
          </a>
        </p>
      </div>
    )
  }

  return <ResetConfirmForm email={email} token={token} />
}
