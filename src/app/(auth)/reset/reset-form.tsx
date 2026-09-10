'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Field, Heading, Input } from '@/components/ui'
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
      <div className="text-center py-2">
        <div className="mx-auto size-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-200">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Check your email.
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed">
          If there&rsquo;s an account for that address, the recovery link is on its way and expires in an hour. Please check your inbox and spam folder.
        </p>
        <div className="mt-8 pt-6 border-t border-[var(--color-line)]/60 text-center">
          <Link href="/login" className="text-sm font-semibold text-[var(--color-signal)] hover:underline">
            ← Return to log in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-signal)] mb-1.5">
          Account Recovery
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Reset password.
        </h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-soft)] leading-relaxed">
          Enter your registered institutional email and we&rsquo;ll send you a secure link to reset your credentials.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-5" noValidate>
        <Field label="Institutional email">
          {(fieldProps) => (
            <Input 
              {...fieldProps} 
              name="email" 
              type="email" 
              autoComplete="email" 
              placeholder="you@kiit.ac.in" 
              required 
            />
          )}
        </Field>
        
        <Button 
          type="submit" 
          size="lg" 
          fullWidth 
          disabled={pending}
          className="mt-2 text-sm font-semibold tracking-wide uppercase bg-gradient-to-r from-[var(--color-signal)] to-[#5a141e] hover:from-[#8f2433] hover:to-[var(--color-signal)] shadow-md hover:shadow-lg transition-all duration-300"
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending Link…
            </span>
          ) : (
            'Send Recovery Link →'
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--color-line)]/60 text-center">
        <Link href="/login" className="text-sm font-semibold text-[var(--color-signal)] hover:underline transition-all">
          ← Back to log in
        </Link>
      </div>
    </div>
  )
}
