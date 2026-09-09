'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ButtonLink, Heading } from '@/components/ui'

export function VerifyConfirm({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<'checking' | 'ok' | 'error'>('checking')

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/password/verify/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    })
      .then((res) => {
        if (!cancelled) setState(res.ok ? 'ok' : 'error')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [email, token])

  if (state === 'checking') {
    return (
      <div>
        <Heading as="h1" size="title">
          Confirming your email.
        </Heading>
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-muted)]" role="status">
          One moment.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div>
        <Heading as="h1" size="title">
          That link has expired.
        </Heading>
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          <Link href="/verify" className="font-medium text-[var(--color-signal)]">
            Request a new one.
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Email confirmed.
      </Heading>
      <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
        You&rsquo;re all set. Your account is verified and everything is open to you.
      </p>
      <div className="mt-6">
        <ButtonLink href="/dashboard" size="lg" fullWidth>
          Go to your dashboard
        </ButtonLink>
      </div>
    </div>
  )
}
