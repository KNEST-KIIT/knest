import type { Metadata } from 'next'
import { getSessionUser } from '@/server/auth/guards'
import { Heading } from '@/components/ui'
import { emailSchema } from '@/server/auth/validation'
import { ResendButton } from './resend-button'

export const metadata: Metadata = { title: 'Check your email' }

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; email?: string }>
}) {
  const { sent, email: emailParam } = await searchParams
  const user = await getSessionUser()

  // Right after sign-up there is no session yet. The address shown is whatever
  // the person typed, so the page says what we did without confirming that an
  // account was created (KN-22b).
  const typed = sent ? emailSchema.safeParse(emailParam) : null
  const email = user?.email ?? (typed?.success ? typed.data : null)

  if (!email) {
    return (
      <div>
        <Heading as="h1" size="title">
          Check your email.
        </Heading>
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          <a href="/login" className="font-medium text-[var(--color-signal)]">
            Log in
          </a>{' '}
          to request a new verification link.
        </p>
      </div>
    )
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Check your email.
      </Heading>
      <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
        We&rsquo;ve sent a message to <strong>{email}</strong>. Open the link in it to continue. It expires in 24 hours.
      </p>
      <div className="mt-6 flex items-center gap-4">
        <span className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          Didn&rsquo;t arrive? Check spam, or
        </span>
        <ResendButton email={email} />
      </div>
    </div>
  )
}
