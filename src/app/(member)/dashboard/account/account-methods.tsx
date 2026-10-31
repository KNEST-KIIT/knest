'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, PasswordInput } from '@/components/ui'
import { formRequest } from '@/lib/form-request'
import { useClientReady } from '@/lib/use-client-ready'

function GoogleIcon() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

export function AccountMethods({
  hasPassword,
  googleLinked,
  googleEnabled,
}: {
  hasPassword: boolean
  googleLinked: boolean
  googleEnabled: boolean
}) {
  const ready = useClientReady()
  const params = useSearchParams()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(
    params.get('error') === 'GoogleLinkRequired'
      ? 'Google was not connected. Confirm your current password below, then select the Google account with this same email.'
      : null,
  )
  const passwordRef = useRef<HTMLInputElement>(null)

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const response = await formRequest('/api/auth/google/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: form.get('password') }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || typeof data.url !== 'string') {
      setError(data.error ?? 'Google could not connect. Try again.')
      setPending(false)
      passwordRef.current?.focus()
      return
    }
    window.location.assign(data.url)
  }

  async function sendSetup() {
    setPending(true)
    setError(null)
    const response = await formRequest('/api/auth/password/setup', { method: 'POST' })
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      setMessage(
        'Check your email for a secure password link. It expires in one hour. Saving a password signs you out on all devices; Google remains connected.',
      )
    } else {
      setError(data.error ?? 'We could not send the email. Try again.')
    }
    setPending(false)
  }

  return (
    <div className="mt-8 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-[var(--color-critical)]">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {/* Email & Password Card */}
      <section className="rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔑</span>
            <h3 className="font-semibold text-[var(--color-ink)]">Email &amp; Password</h3>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
              hasPassword
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {hasPassword ? 'Enabled' : 'Not Set'}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          {hasPassword
            ? 'Active. You can sign in using your email address and personal KNEST password.'
            : 'Add a password to enable direct email & password authentication alongside institutional Google SSO.'}
        </p>
        <div className="mt-4">
          <Button onClick={sendSetup} disabled={!ready || pending} variant="secondary" size="sm">
            {pending
              ? 'Sending link…'
              : hasPassword
                ? 'Email Password Reset Link'
                : 'Email Password Setup Link'}
          </Button>
        </div>
      </section>

      {/* Google SSO Card */}
      <section className="rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GoogleIcon />
            <h3 className="font-semibold text-[var(--color-ink)]">Google Authentication</h3>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
              googleLinked
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : googleEnabled
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-stone-100 text-stone-500 border border-stone-200'
            }`}
          >
            {googleLinked ? 'Connected' : googleEnabled ? 'Available' : 'Disabled'}
          </span>
        </div>

        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
          {googleLinked
            ? 'Connected. "Continue with Google" signs directly into this KNEST account.'
            : googleEnabled
              ? 'Connect your university or personal Google account with this same email. Enter your KNEST password below to verify ownership.'
              : 'Google sign-in is not configured in this environment.'}
        </p>

        {googleLinked && params.get('google') === 'connected' && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            ✓ Google has been successfully linked to your profile.
          </div>
        )}

        {!googleLinked && googleEnabled && hasPassword && (
          <form method="post" onSubmit={connect} className="mt-5 border-t border-[var(--color-line)]/60 pt-4" aria-busy={pending}>
            <fieldset disabled={!ready || pending} className="min-w-0 space-y-4 max-w-md">
              <Field label="Current KNEST password">
                {(props) => (
                  <PasswordInput
                    {...props}
                    ref={passwordRef}
                    name="password"
                    autoComplete="current-password"
                    required
                  />
                )}
              </Field>
              <Button type="submit" disabled={!ready || pending} className="flex items-center gap-2">
                <GoogleIcon />
                <span>{pending ? 'Connecting Google…' : 'Authorize & Connect Google'}</span>
              </Button>
            </fieldset>
          </form>
        )}
      </section>
    </div>
  )
}
