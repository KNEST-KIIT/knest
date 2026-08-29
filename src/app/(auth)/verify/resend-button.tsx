'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function ResendButton({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function resend() {
    setState('sending')
    await fetch('/api/auth/password/verify/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setState('sent')
  }

  if (state === 'sent') {
    return <p className="text-[length:var(--text-small)] text-[var(--color-positive)]">Sent. Check your inbox.</p>
  }

  return (
    <Button variant="secondary" size="sm" onClick={resend} disabled={state === 'sending'}>
      {state === 'sending' ? 'Sending…' : 'Send it again'}
    </Button>
  )
}
