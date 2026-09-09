'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Select, Textarea } from '@/components/ui'

/**
 * The decision. Two outcomes and a note.
 *
 * Unlike the application review's note — which is explicitly internal — this
 * one is shown to the founder. A refused level with no reason attached is what
 * makes a ladder feel arbitrary, so the label says so out loud and the field is
 * required on a rejection.
 */
export function DecisionForm({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!status) return
    if (status === 'rejected' && note.trim().length === 0) {
      setError('Say why. The founder sees this.')
      return
    }

    setPending(true)
    setError(null)
    const response = await fetch(`/api/admin/level-requests/${requestId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note: note.trim() || undefined }),
    })
    setPending(false)
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error ?? 'Something went wrong.')
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[length:var(--text-small)] font-medium">Decision</span>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} required>
          <option value="">Choose…</option>
          <option value="approved">Approve — grant the level</option>
          <option value="rejected">Not yet</option>
        </Select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[length:var(--text-small)] font-medium">
          Reason — the founder will see this
        </span>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          placeholder="What tipped it, or what would."
        />
      </label>

      <Button type="submit" disabled={pending || !status}>
        {pending ? 'Saving…' : 'Record decision'}
      </Button>

      {error && (
        <p role="alert" className="text-[length:var(--text-small)] text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </form>
  )
}
