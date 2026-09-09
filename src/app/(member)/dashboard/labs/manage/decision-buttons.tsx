'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Textarea } from '@/components/ui'

/**
 * Approve or decline, with a note the founder sees.
 *
 * Required on a decline for the same reason the level queue requires one: a
 * refusal with no reason attached is what makes a system feel arbitrary, and
 * "the equipment is down that week" is a sentence the founder can act on.
 *
 * The one error this has to render well is the exclusion constraint firing —
 * two managers approving overlapping slots at the same moment. That comes back
 * as a 409 with "That slot was just taken", which is the truth rather than a
 * generic failure.
 */
export function DecisionButtons({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(status: 'approved' | 'rejected') {
    if (status === 'rejected' && note.trim().length === 0) {
      setError('Say why — the founder sees this.')
      return
    }

    setPending(status)
    setError(null)
    const response = await fetch(`/api/labs/bookings/${bookingId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note: note.trim() || undefined }),
    })
    setPending(null)

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error ?? 'Something went wrong.')
      // A 409 means the world moved under us, so re-read it rather than
      // leaving a stale card on screen next to the explanation.
      if (response.status === 409) router.refresh()
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[length:var(--text-small)] font-medium">
          A note back — required if you decline
        </span>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Anything they should know before they turn up."
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => decide('approved')} disabled={pending !== null}>
          {pending === 'approved' ? 'Approving…' : 'Approve'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => decide('rejected')}
          disabled={pending !== null}
        >
          {pending === 'rejected' ? 'Declining…' : 'Decline'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[length:var(--text-small)] text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </div>
  )
}
