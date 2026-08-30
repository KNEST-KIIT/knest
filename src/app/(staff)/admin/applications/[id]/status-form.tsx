'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, Field, Select, Textarea, useToast } from '@/components/ui'

const LABELS: Record<string, string> = {
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Not this time',
  waitlisted: 'Waitlisted',
}

/**
 * The two statuses with no outgoing transitions in
 * `src/server/applications/transitions.ts`. Reaching either one ends the
 * application and emails the applicant, and there is no way back through the
 * UI, so these are the moves that get a confirmation step. Everything else
 * is reversible enough to just do.
 */
const TERMINAL = new Set(['accepted', 'rejected'])

export function StatusForm({ applicationId, options }: { applicationId: string; options: string[] }) {
  const router = useRouter()
  const toast = useToast()
  const [status, setStatus] = useState(options[0] ?? '')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (options.length === 0) {
    return (
      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        This application is in a final state.
      </p>
    )
  }

  const label = LABELS[status] ?? status
  const isTerminal = TERMINAL.has(status)

  async function apply() {
    setPending(true)
    const res = await fetch(`/api/admin/applications/${applicationId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note: note || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setPending(false)
    setConfirming(false)

    if (!res.ok) {
      toast({
        tone: 'error',
        title: 'Status not changed',
        description: data.error ?? 'Something went wrong. The application is unchanged.',
      })
      return
    }

    // Said out loud, because the only other evidence the action worked is
    // the page quietly re-rendering with a different badge on it.
    toast({
      tone: 'success',
      title: `Moved to ${label}`,
      description: 'The applicant has been notified.',
    })
    setNote('')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Move to">
        {(fieldProps) => (
          <Select {...fieldProps} value={status} onChange={(e) => setStatus(e.target.value)}>
            {options.map((o) => (
              <option key={o} value={o}>
                {LABELS[o] ?? o}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Internal note" optional hint="Not shown to the applicant.">
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            placeholder="Why this decision?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Field>

      <Button
        onClick={() => (isTerminal ? setConfirming(true) : apply())}
        pending={pending}
        pendingLabel="Updating status"
      >
        Update status
      </Button>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={apply}
        pending={pending}
        tone={status === 'rejected' ? 'danger' : 'default'}
        title={`Move to ${label}?`}
        description={`This is a final decision — the application cannot be moved again afterwards, and the applicant is emailed straight away.`}
        confirmLabel={`Yes, move to ${label}`}
        cancelLabel="Go back"
      />
    </div>
  )
}
