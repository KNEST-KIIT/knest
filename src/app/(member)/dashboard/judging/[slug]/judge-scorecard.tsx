'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { submitJudgeScores } from '@/server/hackathons/actions'

type Criterion = {
  id: string
  name: string
  weight: number
  description: string
}

type Assignment = {
  submissionId: string
  submission: {
    id: string
    projectTitle: string
    tagline: string
    description: string
    repoUrl: string | null
    demoUrl: string | null
    videoUrl: string | null
    techStack: string[]
    team: { id: string; name: string }
    scores: { criterionId: string; score: number; notes: string | null }[]
  }
}

export function JudgeScorecard({
  hackathonId,
  criteria,
  assignments,
}: {
  hackathonId: string
  criteria: Criterion[]
  assignments: Assignment[]
}) {
  const router = useRouter()
  const [selectedSubId, setSelectedSubId] = useState<string>(
    assignments[0]?.submissionId ?? '',
  )

  const activeAssignment = assignments.find((a) => a.submissionId === selectedSubId)

  // Initialize scores map for the active submission
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    if (activeAssignment) {
      for (const s of activeAssignment.submission.scores) {
        initial[s.criterionId] = s.score
      }
    }
    return initial
  })

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    if (activeAssignment) {
      for (const s of activeAssignment.submission.scores) {
        if (s.notes) initial[s.criterionId] = s.notes
      }
    }
    return initial
  })

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSelectSubmission(subId: string) {
    setSelectedSubId(subId)
    const target = assignments.find((a) => a.submissionId === subId)
    const newScores: Record<string, number> = {}
    const newNotes: Record<string, string> = {}
    if (target) {
      for (const s of target.submission.scores) {
        newScores[s.criterionId] = s.score
        if (s.notes) newNotes[s.criterionId] = s.notes
      }
    }
    setScores(newScores)
    setNotes(newNotes)
    setSuccess(null)
    setError(null)
  }

  // Calculate live weighted score (normalized out of 100)
  let weightedTotal = 0
  for (const c of criteria) {
    const scoreVal = scores[c.id] ?? 0
    weightedTotal += (scoreVal * c.weight) / 10
  }
  const roundedTotal = Math.round(weightedTotal * 10) / 10

  async function handleSaveScores() {
    setSaving(true)
    setError(null)

    const payload = criteria.map((c) => ({
      criterionId: c.id,
      score: scores[c.id] ?? 5,
      notes: notes[c.id] || undefined,
    }))

    const res = await submitJudgeScores(hackathonId, selectedSubId, payload)
    setSaving(false)

    if (res.ok) {
      setSuccess('Evaluation scores recorded!')
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center">
        <p className="text-xs text-[var(--color-ink-muted)]">
          You currently have no submissions assigned in your judging queue.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left Column: Assigned Queue */}
      <div className="lg:col-span-4 flex flex-col gap-3">
        <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
          Assigned Submissions ({assignments.length})
        </h3>

        <div className="flex flex-col gap-2">
          {assignments.map((a) => {
            const isSelected = a.submissionId === selectedSubId
            const isScored = a.submission.scores.length > 0

            return (
              <button
                key={a.submissionId}
                onClick={() => handleSelectSubmission(a.submissionId)}
                className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-[var(--color-signal)] bg-white shadow-xs'
                    : 'border-[var(--color-line)] bg-[var(--color-paper-soft)]/40 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[var(--color-ink)]">
                    {a.submission.projectTitle || 'Untitled Project'}
                  </span>
                  {isScored ? (
                    <span className="text-[length:var(--text-micro)] font-bold text-[var(--color-positive)]">✓ Scored</span>
                  ) : (
                    <span className="text-[length:var(--text-micro)] font-medium text-[var(--color-ink-muted)]">Pending</span>
                  )}
                </div>
                <p className="mt-1 text-[length:var(--text-micro)] text-[var(--color-ink-soft)] truncate">
                  Team: {a.submission.team.name}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Column: Active Scorecard & Project Details */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        {activeAssignment && (
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-sm">
            {/* Project Overview */}
            <div className="border-b border-[var(--color-line)]/70 pb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-signal)]">
                  Team: {activeAssignment.submission.team.name}
                </span>
                <span className="font-mono text-sm font-bold text-[var(--color-ink)]">
                  Score: {roundedTotal} / 100
                </span>
              </div>

              <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
                {activeAssignment.submission.projectTitle}
              </h2>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                {activeAssignment.submission.tagline}
              </p>

              {activeAssignment.submission.description && (
                <p className="mt-3 text-xs text-[var(--color-ink-muted)] leading-relaxed whitespace-pre-line">
                  {activeAssignment.submission.description}
                </p>
              )}

              {/* Resource Links */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                {activeAssignment.submission.repoUrl && (
                  <a
                    href={activeAssignment.submission.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--color-signal)] hover:underline"
                  >
                    GitHub Repository ↗
                  </a>
                )}
                {activeAssignment.submission.demoUrl && (
                  <a
                    href={activeAssignment.submission.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--color-signal)] hover:underline"
                  >
                    Live Demo ↗
                  </a>
                )}
                {activeAssignment.submission.videoUrl && (
                  <a
                    href={activeAssignment.submission.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--color-signal)] hover:underline"
                  >
                    Demo Video ↗
                  </a>
                )}
              </div>
            </div>

            {/* Rubric Evaluation Sliders */}
            <div className="mt-6 flex flex-col gap-5">
              <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
                Rubric Criteria Evaluation
              </h3>

              {criteria.map((crit) => {
                const currentScore = scores[crit.id] ?? 5

                return (
                  <div
                    key={crit.id}
                    className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft)]/30 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-xs text-[var(--color-ink)]">
                          {crit.name}
                        </span>
                        <span className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)] ml-2">
                          (Weight: {crit.weight}%)
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[var(--color-signal)]">
                        {currentScore} / 10
                      </span>
                    </div>

                    <p className="mt-1 text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
                      {crit.description}
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">1</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={currentScore}
                        onChange={(e) =>
                          setScores({ ...scores, [crit.id]: Number(e.target.value) })
                        }
                        className="w-full accent-[var(--color-signal)] cursor-pointer"
                      />
                      <span className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">10</span>
                    </div>

                    <div className="mt-3">
                      <input
                        placeholder="Optional feedback or notes for this criterion..."
                        value={notes[crit.id] ?? ''}
                        onChange={(e) =>
                          setNotes({ ...notes, [crit.id]: e.target.value })
                        }
                        className="w-full rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1 text-xs text-[var(--color-ink)]"
                      />
                    </div>
                  </div>
                )
              })}

              {error && (
                <div className="rounded-xl border border-[var(--color-critical)]/30 bg-[var(--color-critical)]/10 p-3 text-xs text-[var(--color-critical)]">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-[var(--color-positive)]/30 bg-[var(--color-positive-wash)] p-3 text-xs text-[var(--color-positive)]">
                  {success}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between border-t border-[var(--color-line)]/70 pt-4">
                <span className="text-xs text-[var(--color-ink-muted)]">
                  Weights calculate total contribution automatically.
                </span>

                <Button onClick={handleSaveScores} disabled={saving} size="sm">
                  {saving ? 'Recording...' : '💾 Submit Scorecard'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
