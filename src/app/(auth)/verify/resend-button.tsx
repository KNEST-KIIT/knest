'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formRequest } from '@/lib/form-request'

export function ResendButton({ email, next }: { email: string; next?: string | null }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function resend() {
    setState('sending')
    setError(null)
    const response = await formRequest('/api/auth/password/verify/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, next }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? 'We couldn’t send the link. Try again.')
      setState('idle')
      return
    }
    setState('sent')
  }

  if (state === 'sent') {
    return <p className="text-[length:var(--text-small)] text-[var(--color-positive)]">Sent. Check your inbox.</p>
  }

  return (
    <div>
    <Button variant="secondary" size="sm" onClick={resend} disabled={state === 'sending'}>
      {state === 'sending' ? 'Sending…' : 'Send it again'}
    </Button>
    {error && <p role="alert" className="mt-3 text-[var(--color-critical)]">{error}</p>}
    </div>
  )
}
