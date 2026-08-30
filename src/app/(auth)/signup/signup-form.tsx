'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ButtonLink, Field, FormError, Heading, Input, PasswordInput } from '@/components/ui'
import { Button } from '@/components/ui/button'

export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const res = await fetch('/api/auth/password/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password'),
      }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Try again.')
      setPending(false)
      // A failed submit moves focus to the first field, per UX_WIREFRAMES.md §5.
      nameRef.current?.focus()
      return
    }

    const next = searchParams.get('next')
    // A next that already targets /onboarding (e.g. the homepage journey
    // selector's ?stage= prefill) goes there directly rather than being
    // re-wrapped — /onboarding itself never reads a `next` param, so
    // wrapping it here would just discard the stage it carries.
    if (next?.startsWith('/onboarding')) {
      router.push(next)
    } else {
      router.push(next ? `/onboarding?next=${encodeURIComponent(next)}` : '/onboarding')
    }
    router.refresh()
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Start your journey.
      </Heading>
      <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
        One account. It follows you from your first event to your first venture.
      </p>

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
        <Field label="Your name">
          {(fieldProps) => (
            <Input {...fieldProps} ref={nameRef} name="name" type="text" autoComplete="name" required />
          )}
        </Field>

        <Field label="Email">
          {(fieldProps) => (
            <Input {...fieldProps} name="email" type="email" autoComplete="email" required />
          )}
        </Field>

        <Field label="Password" hint="At least 12 characters. Length matters more than symbols.">
          {(fieldProps) => (
            <PasswordInput {...fieldProps} name="password" autoComplete="new-password" minLength={12} required />
          )}
        </Field>

        <FormError>{error}</FormError>

        <Button type="submit" size="lg" fullWidth pending={pending} pendingLabel="Creating your account">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-[length:var(--text-small)]">
        Already have one?{' '}
        <a href="/login" className="font-medium text-[var(--color-signal)]">
          Log in.
        </a>
      </p>
    </div>
  )
}
