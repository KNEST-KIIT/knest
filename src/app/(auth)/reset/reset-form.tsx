'use client'

import { useState } from 'react'
import { Field, FormError, Heading, Input } from '@/components/ui'
import { Button } from '@/components/ui/button'

export function ResetForm() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const form = new FormData(event.currentTarget)
    await fetch('/api/auth/password/reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email') }),
    })
    // Identical response whether or not the account exists (CONTENT_SPEC.md §3)
    // — this endpoint always reports success.
    setSent(true)
    setPending(false)
  }

  if (sent) {
    return (
      <div>
        <Heading as="h1" size="title">
          Check your email.
        </Heading>
        <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          If there&rsquo;s an account for that address, the link is on its way. Check your inbox.
        </p>
      </div>
    )
  }

  return (
    <div>
      <Heading as="h1" size="title">
        Reset your password.
      </Heading>
      <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
        Enter your email and we&rsquo;ll send you a link.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <Field label="Email">
          {(fieldProps) => <Input {...fieldProps} name="email" type="email" autoComplete="email" required />}
        </Field>
        <Button type="submit" size="lg" fullWidth pending={pending} pendingLabel="Sending">
          Send reset link
        </Button>
      </form>
    </div>
  )
}
