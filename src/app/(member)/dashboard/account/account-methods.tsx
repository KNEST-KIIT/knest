'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, PasswordInput } from '@/components/ui'
import { formRequest } from '@/lib/form-request'
import { useClientReady } from '@/lib/use-client-ready'

export function AccountMethods({ hasPassword, googleLinked, googleEnabled }: { hasPassword: boolean; googleLinked: boolean; googleEnabled: boolean }) {
  const ready = useClientReady()
  const params = useSearchParams()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(params.get('error') === 'GoogleLinkRequired'
    ? 'Google wasn’t connected. Confirm your current password below, then select the Google account with this same email.' : null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const response = await formRequest('/api/auth/google/link', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: form.get('password') }),
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
    if (response.ok) setMessage('Check your email for a secure password link. It expires in one hour. Saving a password signs you out on all devices; Google remains connected.')
    else setError(data.error ?? 'We couldn’t send the email. Try again.')
    setPending(false)
  }

  return (
    <div className="mt-8 space-y-6">
      {error && <p role="alert" className="text-sm text-[var(--color-critical)]">{error}</p>}
      {message && <p role="status" className="text-sm text-[var(--color-positive)]">{message}</p>}
      <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
        <h2 className="font-semibold">Email and password</h2>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{hasPassword ? 'Enabled. You can sign in with your KNEST password.' : 'Add a password to use email sign-in as well as Google.'}</p>
        <Button onClick={sendSetup} disabled={!ready || pending} variant="secondary" className="mt-4">{pending ? 'Please wait…' : hasPassword ? 'Email a password reset link' : 'Email a password setup link'}</Button>
      </section>
      <section className="rounded-xl border border-[var(--color-line)] bg-white p-6">
        <h2 className="font-semibold">Google</h2>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{googleLinked ? 'Connected. Continue with Google uses this same KNEST account.' : googleEnabled ? 'Connect the Google account with this same email. Confirm your KNEST password first to protect your account.' : 'Google sign-in is not available in this environment.'}</p>
        {googleLinked && params.get('google') === 'connected' && <p role="status" className="mt-3 text-sm text-[var(--color-positive)]">Google is connected.</p>}
        {!googleLinked && googleEnabled && hasPassword && (
          <form method="post" onSubmit={connect} className="mt-5" aria-busy={pending}>
            <fieldset disabled={!ready || pending} className="min-w-0 space-y-4">
              <Field label="Current KNEST password">{(props) => <PasswordInput {...props} ref={passwordRef} name="password" autoComplete="current-password" required />}</Field>
              <Button type="submit" disabled={!ready || pending}>{pending ? 'Connecting…' : 'Connect Google'}</Button>
            </fieldset>
          </form>
        )}
      </section>
    </div>
  )
}
