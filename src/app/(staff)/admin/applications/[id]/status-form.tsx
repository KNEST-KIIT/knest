'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui'

const LABELS: Record<string, string> = {
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Not this time',
  waitlisted: 'Waitlisted',
}

export function StatusForm({ applicationId, options }: { applicationId: string; options: string[] }) {
  const router = useRouter()
  const [status, setStatus] = useState(options[0] ?? '')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (options.length === 0) {
    return <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">This application is in a final state.</p>
  }

  async function submit() {
    setPending(true)
    setError(null)
    const res = await fetch(`/api/admin/applications/${applicationId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note: note || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setPending(false)
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            Move to: {LABELS[o] ?? o}
          </option>
        ))}
      </select>
      <Textarea
        placeholder="Optional note (not shown to the applicant)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p role="alert" className="text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}
      <Button onClick={submit} disabled={pending}>
        {pending ? 'Updating…' : 'Update status'}
      </Button>
    </div>
  )
}
