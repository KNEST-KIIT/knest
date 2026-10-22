'use client'

import { formRequest } from '@/lib/form-request'
import { useClientReady } from '@/lib/use-client-ready'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Field, Heading, PasswordInput } from '@/components/ui'
import { Button } from '@/components/ui/button'

export function ResetConfirmForm({ email, token, next }: { email: string; token: string; next?: string | null }) {
  const ready = useClientReady()
  const resetHref = next ? `/reset?next=${encodeURIComponent(next)}` : '/reset'
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const res = await formRequest('/api/auth/password/reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, password: form.get('password') }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error ?? 'That link has expired. Request a new one.')
      setPending(false)
      passwordRef.current?.focus()
      return
    }

    router.push(`/login?reset=success${next ? `&next=${encodeURIComponent(next)}` : ''}`)
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Set a new password.
      </Heading>

      <form method="post" onSubmit={onSubmit} className="mt-6" noValidate aria-busy={pending}>
        <fieldset disabled={!ready || pending} className="flex min-w-0 flex-col gap-5">
        <Field label="New password" hint="At least 12 characters.">
          {(fieldProps) => (
            <PasswordInput {...fieldProps} ref={passwordRef} name="password" autoComplete="new-password" minLength={12} required />
          )}
        </Field>

        {error && (
          <p role="alert" className="text-[length:var(--text-small)] text-[var(--color-critical)]">
            {error}{' '}
            <a href={resetHref} className="font-medium text-[var(--color-signal)]">
              Request a new link.
            </a>
          </p>
        )}

        <Button type="submit" size="lg" fullWidth disabled={!ready || pending} aria-busy={pending} className={pending ? 'disabled:opacity-100 disabled:cursor-progress' : undefined}>
          {pending ? 'Saving…' : 'Save new password'}
        </Button>
        </fieldset>
      </form>
    </div>
  )
}
