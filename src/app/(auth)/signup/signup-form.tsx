'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ButtonLink, Field, Heading, Input, PasswordInput } from '@/components/ui'
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
      <div className="mb-6">
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-signal)] mb-1.5">
          Founder Onboarding
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Start your journey.
        </h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-soft)] leading-relaxed">
          One institutional account. It follows you from first prototype to funded venture.
        </p>
      </div>

      {googleEnabled && (
        <>
          <ButtonLink href="/api/auth/signin/google" variant="secondary" fullWidth className="mt-4">
            <svg className="size-4 mr-1.5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Sign up with Google
          </ButtonLink>
          <div className="my-5 flex items-center gap-4 text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            <span className="h-px flex-1 bg-[var(--color-line)]" />
            or with email
            <span className="h-px flex-1 bg-[var(--color-line)]" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4 sm:gap-5" noValidate>
        <Field label="Full name">
          {(fieldProps) => (
            <Input 
              {...fieldProps} 
              ref={nameRef} 
              name="name" 
              type="text" 
              autoComplete="name" 
              placeholder="Aarav Sharma" 
              required 
            />
          )}
        </Field>

        <Field label="Email address">
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

        <Field label="Create password" hint="At least 12 characters. Length matters more than symbols.">
          {(fieldProps) => (
            <PasswordInput 
              {...fieldProps} 
              name="password" 
              autoComplete="new-password" 
              placeholder="••••••••••••" 
              minLength={12} 
              required 
            />
          )}
        </Field>

        {error && (
          <div role="alert" className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-[var(--color-critical)] flex items-start gap-2">
            <svg className="size-4 shrink-0 mt-0.5 text-[var(--color-critical)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

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
              Creating account…
            </span>
          ) : (
            'Create Founder Account →'
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--color-line)]/60 text-center">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Already have an account?{' '}
          <a href="/login" className="font-semibold text-[var(--color-signal)] hover:underline transition-all">
            Log in →
          </a>
        </p>
      </div>
    </div>
  )
}
