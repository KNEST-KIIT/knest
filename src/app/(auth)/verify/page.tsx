import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/server/auth/guards'
import { ResendButton } from './resend-button'

export const metadata: Metadata = { title: 'Check your email' }

export default async function VerifyPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-title)] font-extrabold uppercase leading-tight">
        Check your email.
      </h1>
      <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
        We&rsquo;ve sent a link to <strong>{user.email}</strong>. It expires in 24 hours.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <span className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          Didn&rsquo;t arrive? Check spam, or
        </span>
        <ResendButton email={user.email ?? ''} />
      </div>
    </div>
  )
}
