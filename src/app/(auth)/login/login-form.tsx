'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ButtonLink, Field, FormError, Heading, Input, PasswordInput } from '@/components/ui'
import { Button } from '@/components/ui/button'

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const res = await fetch('/api/auth/password/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Try again.')
      setPending(false)
      emailRef.current?.focus()
      return
    }

    const next = searchParams.get('next')
    router.push(next && next.startsWith('/') ? next : '/dashboard')
    router.refresh()
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Welcome back.
      </Heading>

      {googleEnabled && (
        <>
          <ButtonLink href="/api/auth/signin/google" variant="secondary" fullWidth className="mt-6">
            Continue with Google
          </ButtonLink>
          <div className="my-6 flex items-center gap-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            <span className="h-px flex-1 bg-[var(--color-line)]" />
            or
            <span className="h-px flex-1 bg-[var(--color-line)]" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <Field label="Email">
          {(fieldProps) => (
            <Input {...fieldProps} ref={emailRef} name="email" type="email" autoComplete="email" required />
          )}
        </Field>

        <div>
          <Field label="Password">
            {(fieldProps) => (
              <PasswordInput {...fieldProps} name="password" autoComplete="current-password" required />
            )}
          </Field>
          <a href="/reset" className="mt-1 -mb-2 inline-flex h-11 items-center text-[length:var(--text-small)] text-[var(--color-signal)]">
            Forgot your password?
          </a>
        </div>

        <FormError>{error}</FormError>

        <Button type="submit" size="lg" fullWidth pending={pending} pendingLabel="Logging in">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-[length:var(--text-small)]">
        New to KNEST?{' '}
        <a href="/signup" className="font-medium text-[var(--color-signal)]">
          Start your journey.
        </a>
      </p>
    </div>
  )
}
