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
  const [confirmingDecision, setConfirmingDecision] = useState(false)
  const [refreshing, startRefresh] = useTransition()
  const busy = pending || refreshing
  const selectedStatus = options.includes(status) ? status : ''
  const isFinalDecision = selectedStatus === 'accepted' || selectedStatus === 'rejected'

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
    setConfirmingDecision(false)
    startRefresh(() => router.refresh())
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Next status" hint="Choose deliberately. The applicant is notified when the status changes.">
        {(field) => <select
        {...field}
        disabled={busy}
        value={selectedStatus}
        onChange={(e) => { setStatus(e.target.value); setSuccess(null); setError(null); setConfirmingDecision(false) }}
        className="h-[var(--control-height-lg)] min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3"
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
      {error && <button type="button" disabled={busy} onClick={() => startRefresh(() => router.refresh())} className="text-sm underline min-h-[44px] flex items-center">Refresh current status</button>}

      {isFinalDecision && confirmingDecision ? (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={`final-decision-title-${applicationId}`}
          aria-describedby={`final-decision-description-${applicationId}`}
          className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-[var(--color-critical)] bg-[var(--color-paper-soft)] p-4"
        >
          <div>
            <p id={`final-decision-title-${applicationId}`} className="font-semibold text-sm text-[var(--color-critical)]">
              Confirm permanent decision: {LABELS[selectedStatus] ?? selectedStatus}
            </p>
            <p id={`final-decision-description-${applicationId}`} className="mt-1 text-xs text-[var(--color-ink)]">
              This is a final decision for this application and cannot be moved back. Check the application before updating.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant={selectedStatus === 'rejected' ? 'danger' : 'primary'}
              disabled={busy}
              onClick={submit}
              className="min-h-11"
            >
              {busy ? 'Updating…' : `Yes, confirm ${LABELS[selectedStatus] ?? selectedStatus}`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmingDecision(false)}
              className="min-h-11"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => {
            if (isFinalDecision) {
              setConfirmingDecision(true)
            } else {
              submit()
            }
          }}
          disabled={!selectedStatus || busy}
          className="min-h-11"
        >
          {busy ? 'Updating…' : isFinalDecision ? `Review & confirm ${LABELS[selectedStatus] ?? selectedStatus}` : 'Update status'}
        </Button>
      )}
    </div>
  )
}
