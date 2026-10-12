'use client'

import { useEffect, useState } from 'react'
import { Heading } from '@/components/ui'

export function VerifyConfirm({ email, token, next }: { email: string; token: string; next: string | null }) {
  const [state, setState] = useState<'checking' | 'ok' | 'error' | 'network'>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/password/verify/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    })
      .then((res) => {
        if (cancelled) return
        // A 5xx means the server could not decide; the link may still be good.
        setState(res.ok ? 'ok' : res.status >= 500 ? 'network' : 'error')
      })
      .catch(() => {
        if (!cancelled) setState('network')
      })
    return () => {
      cancelled = true
    }
  }, [email, token, attempt])

  // A return path that already targets onboarding goes there directly; any
  // other path rides along as onboarding's own `next`.
  const continueHref = next?.startsWith('/onboarding')
    ? next
    : next
      ? `/onboarding?next=${encodeURIComponent(next)}`
      : '/onboarding'

  if (state === 'checking') {
    return <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Confirming…</p>
  }

  if (state === 'network') {
    return (
      <div>
        <Heading as="h1" size="title">
          We couldn&rsquo;t confirm your email.
        </Heading>
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          The connection dropped before we got an answer. Try again, and if it keeps failing, request a new link from the log in page.{' '}
          <button
            type="button"
            className="font-medium text-[var(--color-signal)] underline"
            onClick={() => {
              setState('checking')
              setAttempt((n) => n + 1)
            }}
          >
            Try again.
          </button>
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
          <a href="/verify" className="font-medium text-[var(--color-signal)]">
            Request a new one.
          </a>
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
        You&rsquo;re signed in.{' '}
        <a href={continueHref} className="font-medium text-[var(--color-signal)]">
          Continue.
        </a>
      </p>
    </div>
  )
}
