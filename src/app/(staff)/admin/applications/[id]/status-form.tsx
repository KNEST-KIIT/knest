'use client'

import { formRequest } from '@/lib/form-request'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, Textarea } from '@/components/ui'

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
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [refreshing, startRefresh] = useTransition()
  const busy = pending || refreshing
  const selectedStatus = options.includes(status) ? status : ''

  if (options.length === 0) {
    return <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">This application is in a final state.</p>
  }

  async function submit() {
    if (!selectedStatus) return
    setPending(true)
    setError(null)
    setSuccess(null)
    const res = await formRequest(`/api/admin/applications/${applicationId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: selectedStatus, note: note || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setPending(false)
    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
        return
      }
      setError(data.error ?? 'Something went wrong.')
      return
    }
    setSuccess(`Updated to ${LABELS[selectedStatus] ?? selectedStatus}. The applicant's status and notification have been updated.`)
    setStatus('')
    setNote('')
    startRefresh(() => router.refresh())
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Next status" hint="Choose deliberately. The applicant is notified when the status changes.">
        {(field) => <select
        {...field}
        disabled={busy}
        value={selectedStatus}
        onChange={(e) => { setStatus(e.target.value); setSuccess(null); setError(null) }}
        className="h-11 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3"
      >
        <option value="" disabled>Choose the next status</option>
        {options.map((o) => (
          <option key={o} value={o}>
            Move to: {LABELS[o] ?? o}
          </option>
        ))}
      </select>}
      </Field>
      <Field label="Internal note" optional hint="Staff only. This note is never included in the applicant's notification.">
        {(field) => <Textarea
        {...field}
        disabled={busy}
        maxLength={2000}
        placeholder="Optional note (not shown to the applicant)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />}
      </Field>
      {error && <p role="alert" className="text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}
      {success && <p role="status" className="text-sm text-[var(--color-ink-soft)]">{success}</p>}
      {error && <button type="button" disabled={busy} onClick={() => startRefresh(() => router.refresh())} className="text-sm underline">Refresh current status</button>}
      {(selectedStatus === 'accepted' || selectedStatus === 'rejected') && <p className="text-sm text-[var(--color-critical)]">This is a final decision for this application and cannot be moved back. Check the application before updating.</p>}
      <Button onClick={submit} disabled={!selectedStatus || busy}>
        {busy ? 'Updating…' : 'Update status'}
      </Button>
    </div>
  )
}
