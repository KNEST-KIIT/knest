'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Buttons on one of the member's own bookings: cancel, or answer a suggested alternative time. */
export function BookingActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(path: string, body: unknown) {
    setPending(true)
    setError(null)
    const res = await fetch(`/api/labs/bookings/${id}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setPending(false)
    if (!res?.ok) {
      setError(data?.error ?? 'That did not go through. Try again.')
      return
    }
    router.refresh()
  }

  const button = 'h-9 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-[length:var(--text-small)] font-medium'
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {status === 'alternative_proposed' && (
          <>
            <button type="button" className={button} disabled={pending} onClick={() => call('respond', { accept: true })}>
              Accept the new time
            </button>
            <button type="button" className={button} disabled={pending} onClick={() => call('respond', { accept: false })}>
              Decline
            </button>
          </>
        )}
        {(status === 'requested' || status === 'approved') && (
          <button type="button" className={button} disabled={pending} onClick={() => call('cancel', {})}>
            Cancel booking
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </div>
  )
}
