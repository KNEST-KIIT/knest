'use client'

import { useRef, useState } from 'react'
import { formRequest } from '@/lib/form-request'
import { Heading, Field, PasswordInput } from '@/components/ui'
import { Button } from '@/components/ui/button'

export function VerifyConfirm({
  email,
  token,
  next,
}: {
  email: string
  token: string
  next: string | null
}) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'ok' | 'expired' | 'network'>('idle')
  const passwordRef = useRef<HTMLInputElement>(null)

  const continueHref = next?.startsWith('/onboarding')
    ? next
    : next
      ? `/onboarding?next=${encodeURIComponent(next)}`
      : '/onboarding'

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldError(undefined)
    setFormError(null)

    if (password.length < 12) {
      setFieldError('Use at least 12 characters.')
      passwordRef.current?.focus()
      return
    }

    setPending(true)
    try {
      const res = await formRequest('/api/auth/password/verify/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      })

      if (res.ok) {
        setStatus('ok')
        return
      }

      if (res.status >= 500) {
        setStatus('network')
      } else {
        const data = await res.json().catch(() => ({}))
        if (data.error?.toLowerCase().includes('expired') || data.error?.toLowerCase().includes('invalid')) {
          setStatus('expired')
        } else {
          setFormError(data.error ?? 'That link has expired. Request a new one.')
        }
      }
    } catch {
      setStatus('network')
    } finally {
      setPending(false)
    }
  }

  if (status === 'ok') {
    return (
      <div>
        <Heading as="h1" size="title">
          Account activated.
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

  if (status === 'expired') {
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

  if (status === 'network') {
    return (
      <div>
        <Heading as="h1" size="title">
          We couldn&rsquo;t activate your account.
        </Heading>
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          The connection dropped before we got an answer.{' '}
          <button
            type="button"
            className="font-medium text-[var(--color-signal)] underline"
            onClick={() => setStatus('idle')}
          >
            Try again.
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md">
      <div className="mb-6">
        <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-signal)] mb-2">
          Confirm your email
        </span>
        <Heading as="h1" size="title">
          Activate your account.
        </Heading>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed">
          Welcome to KNEST, <strong className="text-[var(--color-ink)]">{email}</strong>. Set your password to complete activation and sign in.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field
          label="Choose password"
          hint="At least 12 characters. Length matters more than symbols."
          error={fieldError}
        >
          {(fieldProps) => (
            <PasswordInput
              {...fieldProps}
              ref={passwordRef}
              name="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              minLength={12}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldError) setFieldError(undefined)
              }}
            />
          )}
        </Field>

        {formError && (
          <div role="alert" className="p-3 rounded-[var(--radius-sm)] bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/20 text-xs font-medium text-[var(--color-critical)]">
            {formError}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={pending}
          aria-busy={pending}
          className={`${pending ? 'disabled:opacity-100 disabled:cursor-progress ' : ''}text-xs font-semibold tracking-widest uppercase`}
        >
          {pending ? 'Activating account…' : 'Activate account & sign in →'}
        </Button>
      </form>
    </div>
  )
}
