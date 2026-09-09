'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Textarea } from '@/components/ui'

const MIN_EVIDENCE = 60

/**
 * Asking to move up.
 *
 * Only ever offers the next rung, not a dropdown of all seven. Levels are
 * cumulative and each is meant to be evidenced on its own terms; letting
 * someone at level 1 ask for level 6 produces a request no reviewer can
 * sensibly decide, and a queue full of them.
 */
export function RequestForm({
  currentLevel,
  nextLevel,
  nextLabel,
  nextSummary,
}: {
  currentLevel: number
  nextLevel: number
  nextLabel: string
  nextSummary: string
}) {
  const router = useRouter()
  const [evidence, setEvidence] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const short = evidence.trim().length < MIN_EVIDENCE

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch('/api/founders/level-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedLevel: nextLevel, evidence: evidence.trim() }),
    })
    setPending(false)
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error ?? 'Something went wrong.')
      return
    }
    setEvidence('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-[var(--color-ink-soft)]">
        You’re at level {currentLevel}. Next is level {nextLevel} ({nextLabel}) — {nextSummary}
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-[length:var(--text-small)] font-medium">
          What have you done that shows it?
        </span>
        <Textarea
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
          rows={6}
          placeholder="Specifics beat adjectives. Who did you talk to, what did you ship, what changed as a result?"
          aria-describedby="evidence-help"
        />
        <span id="evidence-help" className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {short
            ? `A couple of sentences at least — ${MIN_EVIDENCE - evidence.trim().length} more characters.`
            : 'One person reads this and decides. Make it easy for them.'}
        </span>
      </label>

      <Button type="submit" disabled={pending || short}>
        {pending ? 'Sending…' : `Ask for level ${nextLevel}`}
      </Button>

      {error && (
        <p role="alert" className="text-[length:var(--text-small)] text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </form>
  )
}
