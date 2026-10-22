'use client'

import { useEffect, useRef, useState } from 'react'
import { formRequest } from '@/lib/form-request'
import { Heading } from '@/components/ui'

export function VerifyConfirm({ email, token, next }: { email: string; token: string; next: string | null }) {
  const [state, setState] = useState<'checking' | 'ok' | 'error' | 'network'>('checking')
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef<{ key: string; promise: Promise<Response> } | null>(null)

  useEffect(() => {
    let cancelled = false
    const key = JSON.stringify([email, token, attempt])
    // Reuse this attempt during Strict Mode's effect replay. Sending twice would
    // consume the single-use link before the visible effect received its answer.
    if (requestRef.current?.key !== key) requestRef.current = { key, promise: formRequest('/api/auth/password/verify/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    }) }
    requestRef.current.promise
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
