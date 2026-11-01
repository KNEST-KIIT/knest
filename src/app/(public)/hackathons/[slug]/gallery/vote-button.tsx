'use client'

import { useState } from 'react'
import { toggleCommunityVote } from '@/server/hackathons/actions'

export function HackathonVoteButton({
  hackathonId,
  submissionId,
  initialCount,
  initialVoted,
  enabled,
}: {
  hackathonId: string
  submissionId: string
  initialCount: number
  initialVoted: boolean
  enabled: boolean
}) {
  const [count, setCount] = useState(initialCount)
  const [voted, setVoted] = useState(initialVoted)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    if (!enabled || loading) return
    setLoading(true)

    // Optimistic update
    const nextVoted = !voted
    const nextCount = nextVoted ? count + 1 : Math.max(0, count - 1)
    setVoted(nextVoted)
    setCount(nextCount)

    const res = await toggleCommunityVote(hackathonId, submissionId)
    setLoading(false)

    if (!res.ok) {
      // Revert on failure
      setVoted(voted)
      setCount(count)
      alert(res.error)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={!enabled || loading}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
        voted
          ? 'bg-[var(--color-signal-wash)] text-[var(--color-signal)] ring-1 ring-[var(--color-signal)]'
          : 'bg-[var(--color-paper-soft)]/60 text-[var(--color-ink-muted)] hover:bg-[var(--color-paper-soft)] hover:text-[var(--color-ink)]'
      }`}
      aria-label="Upvote project"
    >
      <span className={voted ? 'text-[var(--color-signal)] scale-110' : ''}>
        {voted ? '❤️' : '🤍'}
      </span>
      <span>{count}</span>
    </button>
  )
}
