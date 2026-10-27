'use client'

import { formRequest } from '@/lib/form-request'
import { useClientReady } from '@/lib/use-client-ready'
import Link from 'next/link'

import { safeNext } from '@/lib/safe-next'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Field, Input } from '@/components/ui'
import { GoogleButton } from '@/components/auth/google-button'
import { Button } from '@/components/ui/button'
import { TurnstileWidget } from '@/components/security/turnstile-widget'

export function SignupForm({ googleEnabled, turnstileSiteKey }: { googleEnabled: boolean; turnstileSiteKey: string }) {
  const router = useRouter()
  const ready = useClientReady()
  const searchParams = useSearchParams()
  const returnTo = safeNext(searchParams.get('next'))
  const [pending, setPending] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const captchaPending = Boolean(turnstileSiteKey) && !captchaToken
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pending) {
      if (fieldErrors.name) {
        nameRef.current?.focus()
      } else if (fieldErrors.email) {
        emailRef.current?.focus()
      }
    }
  }, [fieldErrors, pending])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setFieldErrors({})

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()

    if (!name) {
      setFieldErrors({ name: 'Tell us your name.' })
      setPending(false)
      return
    }

    if (!email) {
      setFieldErrors({ email: 'Enter your email address.' })
      setPending(false)
      return
    }

    const res = await formRequest('/api/auth/password/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        turnstileToken: captchaToken,
        next: returnTo,
      }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setPending(false)
      setCaptchaToken(null)
      setCaptchaReset((n) => n + 1)
      const err = data.error ?? 'Something went wrong. Try again.'
      if (err.toLowerCase().includes('email') || err.toLowerCase().includes('address')) {
        setFieldErrors({ email: err })
        setError(null)
      } else if (err.toLowerCase().includes('name')) {
        setFieldErrors({ name: err })
        setError(null)
      } else {
        setError(err)
        setFieldErrors({})
      }
      return
    }

    // The same screen for a new and an existing address (KN-22b). The link in
    // the mailbox signs the person in and carries them on to onboarding.
    router.push(`/verify?sent=1&email=${encodeURIComponent(email)}${returnTo ? `&next=${encodeURIComponent(returnTo)}` : ''}`)
  }

  return (
    <div>
      <div className="mb-8">
        <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-signal)] mb-2">
          Create your account
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-ink)]">
          Start your journey.
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed">
          One institutional account. It follows you from first prototype to funded venture.
        </p>
      </div>

      {/* Only when the provider is configured: otherwise this leads to an Auth.js error page (KN-15). */}
      {googleEnabled && (
        <>
        <GoogleButton label="Sign up with Google" next={returnTo} />
      
        <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-medium">
          <span className="h-px flex-1 bg-[var(--color-line)]" />
          or with email
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>
        </>
      )}

      <form method="post" onSubmit={onSubmit} className="mt-6" noValidate aria-busy={pending}>
        <fieldset disabled={!ready || pending} className="flex min-w-0 flex-col gap-5 sm:gap-6">
        <Field label="Full name" error={fieldErrors.name}>
          {(fieldProps) => (
            <Input 
              {...fieldProps} 
              ref={nameRef} 
              name="name" 
              type="text" 
              autoComplete="name" 
              placeholder="Aarav Sharma" 
              required 
              onChange={() => {
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }))
              }}
            />
          )}
        </Field>

        <Field
          label="Email address"
          hint="We’ll send an activation link to your inbox to establish your password."
          error={fieldErrors.email}
        >
          {(fieldProps) => (
            <Input 
              {...fieldProps} 
              ref={emailRef}
              name="email" 
              type="email" 
              autoComplete="email" 
              placeholder="you@kiit.ac.in" 
              required 
              onChange={() => {
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }))
              }}
            />
          )}
        </Field>

        {error && (
          <div role="alert" className="p-3.5 rounded-[var(--radius-sm)] bg-[var(--color-critical)]/10 border border-[var(--color-critical)]/20 text-xs font-medium text-[var(--color-critical)] flex items-start gap-2">
            <svg className="size-4 shrink-0 mt-0.5 text-[var(--color-critical)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <TurnstileWidget siteKey={turnstileSiteKey} action="signup" onToken={setCaptchaToken} resetSignal={captchaReset} />

        <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
          Before creating an account, read our{' '}
          <Link href="/privacy" className="font-medium text-[var(--color-signal)] underline underline-offset-4">privacy policy</Link>{' '}
          and{' '}
          <Link href="/terms" className="font-medium text-[var(--color-signal)] underline underline-offset-4">Terms and Conditions</Link>.
        </p>

        <Button 
          type="submit" 
          size="lg" 
          fullWidth 
          disabled={!ready || pending || captchaPending}
          aria-busy={pending}
          className={`${pending ? 'disabled:opacity-100 disabled:cursor-progress ' : ''}mt-4 text-sm font-semibold tracking-wide uppercase`}
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending activation link…
            </span>
          ) : (
            'Continue with email →'
          )}
        </Button>
        </fieldset>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--color-line)]/50 text-center">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Already have an account?{' '}
          <a href={returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login'} className="font-semibold text-[var(--color-signal)] hover:underline hover:text-[var(--color-signal-deep)] transition-all">
            Log in →
          </a>
        </p>
      </div>
    </div>
  )
}
