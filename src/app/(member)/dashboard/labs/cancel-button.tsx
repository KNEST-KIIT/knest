'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'

/** Giving a slot back. Not a delete — the row stays, marked cancelled. */
export function CancelButton({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cancel() {
    setPending(true)
    setError(null)
    const response = await fetch(`/api/labs/bookings/${bookingId}/cancel`, { method: 'POST' })
    setPending(false)
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error ?? 'Something went wrong.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" onClick={cancel} disabled={pending}>
        {pending ? 'Cancelling…' : 'Cancel'}
      </Button>
      {error && (
        <p role="alert" className="text-[length:var(--text-small)] text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </div>
  )
}
