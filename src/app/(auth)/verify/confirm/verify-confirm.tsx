'use client'

import { useEffect, useState } from 'react'

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
    return <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Confirming…</p>
  }

  if (state === 'error') {
    return (
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-title)] font-extrabold uppercase leading-tight">
          That link has expired.
        </h1>
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
      <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-title)] font-extrabold uppercase leading-tight">
        Email confirmed.
      </h1>
      <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
        You&rsquo;re all set.{' '}
        <a href="/dashboard" className="font-medium text-[var(--color-signal)]">
          Go to your dashboard.
        </a>
      </p>
    </div>
  )
}
