'use client'

import { formRequest } from '@/lib/form-request'

import { safeNext } from '@/lib/safe-next'
import { useRef, useState, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Field, Input, PasswordInput } from '@/components/ui'
import { GoogleButton } from '@/components/auth/google-button'
import { Button } from '@/components/ui/button'
import { TurnstileWidget } from '@/components/security/turnstile-widget'

const subscribe = () => () => {}
const clientReady = () => true
const serverReady = () => false

export function LoginForm({ googleEnabled, turnstileSiteKey, recoveryNext = null }: { googleEnabled: boolean; turnstileSiteKey: string; recoveryNext?: string | null }) {
  // Do not let a slow-loading page submit credentials before React owns the form.
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const captchaPending = Boolean(turnstileSiteKey) && !captchaToken
  // Auth.js sends a failed Google sign-in back here as ?error=<code>. Say what happened and what to do.
  const providerError = searchParams.get('error')
  const [error, setError] = useState<string | null>(
    providerError === 'AccessDenied'
      ? 'This account can’t sign in. Contact the KNEST team if you think that is a mistake.'
      : providerError === 'OAuthAccountNotLinked'
        ? 'You already have a KNEST account with this email. Log in with your password, then open Account to connect Google.'
      : providerError === 'GoogleSessionExpired'
        ? 'Your Google sign-in expired or this browser lost its sign-in check. Select Continue with Google to start again in this tab.'
      : providerError === 'GoogleUnavailable'
        ? 'Google sign-in isn’t available right now. Log in with your email and password.'
        : providerError === 'TooManyAttempts'
        ? 'Too many attempts. Wait a few minutes and try again.'
        : providerError
        ? 'Google sign-in didn’t finish. Try again, or log in with your email and password.'
        : null,
  )
  const emailRef = useRef<HTMLInputElement>(null)
  const next = safeNext(searchParams.get('next')) ?? recoveryNext

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(event.currentTarget)
    const res = await formRequest('/api/auth/password/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password'), turnstileToken: captchaToken }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Try again.')
      setPending(false)
      setCaptchaToken(null)
      setCaptchaReset((n) => n + 1)
      emailRef.current?.focus()
      return
    }

    router.push(next ?? '/auth/complete')
    router.refresh()
  }

  return (
    <div>
      {searchParams.get('reset') === 'success' && <p role="status" className="mb-6 text-sm text-[var(--color-positive)]">Your password is updated. Log in to continue.</p>}
      <div className="mb-8">
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-signal)] mb-2">
          Your KNEST account
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-ink)]">
          Welcome back.
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed">
          Sign in to access your venture dashboard and resources.
        </p>
      </div>

      {/* Only when the provider is configured: otherwise this leads to an Auth.js error page (KN-15). */}
      {googleEnabled && (
        <>
        <GoogleButton label="Continue with Google" next={next} />
      
        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-medium">
          <span className="h-px flex-1 bg-[var(--color-line)]" />
          or with email
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>
        </>
      )}

      <form method="post" action="/api/auth/password/login" onSubmit={onSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        <Field label="Email address">
          {(fieldProps) => (
            <Input 
              {...fieldProps} 
              ref={emailRef} 
              name="email" 
              type="email" 
              autoComplete="email" 
              placeholder="you@kiit.ac.in" 
              required 
              disabled={!ready}
            />
          )}
        </Field>

        <div>
          <Field label="Password">
            {(fieldProps) => (
              <PasswordInput 
                {...fieldProps} 
                name="password" 
                autoComplete="current-password" 
                placeholder="••••••••••••" 
                required 
                disabled={!ready}
              />
            )}
          </Field>
          <div className="mt-1.5 flex justify-end">
            <a 
              href={next ? `/reset?next=${encodeURIComponent(next)}` : '/reset'}
              className="text-[11px] font-medium text-[var(--color-signal)] hover:underline hover:text-[var(--color-signal-deep)] transition-colors"
            >
              Forgot password?
            </a>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-[var(--color-critical)] flex items-start gap-2">
            <svg className="size-4 shrink-0 mt-0.5 text-[var(--color-critical)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <TurnstileWidget siteKey={turnstileSiteKey} action="login" onToken={setCaptchaToken} resetSignal={captchaReset} />

        <Button 
          type="submit" 
          size="lg" 
          fullWidth 
          disabled={!ready || pending || captchaPending}
          aria-busy={pending}
          className={`${pending ? 'disabled:opacity-100 disabled:cursor-progress ' : ''}mt-2 h-14 text-sm font-bold tracking-widest uppercase bg-gradient-to-r from-[var(--color-signal)] to-[#5a141e] hover:from-[#8f2433] hover:to-[var(--color-signal)] shadow-sm hover:shadow-lg transition-all duration-300 rounded-lg`}
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Authenticating…
            </span>
          ) : (
            ready ? 'Log In →' : 'Loading sign-in…'
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--color-line)]/50 text-center">
        <p className="text-sm text-[var(--color-ink-soft)]">
          New to KNEST?{' '}
          <a href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'} className="font-semibold text-[var(--color-signal)] hover:underline hover:text-[var(--color-signal-deep)] transition-all">
            Start your journey →
          </a>
        </p>
      </div>
    </div>
  )
}
