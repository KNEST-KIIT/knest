'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Textarea } from '@/components/ui'
import { saveSubmissionDraft, submitProject } from '@/server/hackathons/actions'
import { safely } from '@/lib/safe-action'

type SubmissionData = {
  id?: string
  status: 'draft' | 'submitted' | 'disqualified'
  projectTitle: string
  tagline: string
  description: string
  repoUrl: string | null
  demoUrl: string | null
  videoUrl: string | null
  figmaUrl: string | null
  techStack: string[]
  selectedTracks: string[]
  submittedAt?: Date | null
}

export function HackathonSubmissionForm({
  hackathonId,
  teamId,
  initialSubmission,
  availableTracks,
  isSubmissionsOpen,
}: {
  hackathonId: string
  teamId: string
  initialSubmission: SubmissionData | null
  availableTracks: { id: string; name: string }[]
  isSubmissionsOpen: boolean
}) {
  const router = useRouter()
  const isSubmitted = initialSubmission?.status === 'submitted'

  const [title, setTitle] = useState(initialSubmission?.projectTitle ?? '')
  const [tagline, setTagline] = useState(initialSubmission?.tagline ?? '')
  const [description, setDescription] = useState(initialSubmission?.description ?? '')
  const [repoUrl, setRepoUrl] = useState(initialSubmission?.repoUrl ?? '')
  const [demoUrl, setDemoUrl] = useState(initialSubmission?.demoUrl ?? '')
  const [videoUrl, setVideoUrl] = useState(initialSubmission?.videoUrl ?? '')
  const [figmaUrl, setFigmaUrl] = useState(initialSubmission?.figmaUrl ?? '')
  const [techStack, setTechStack] = useState(initialSubmission?.techStack?.join(', ') ?? '')
  const [tracks, setTracks] = useState<string[]>(initialSubmission?.selectedTracks ?? [])

  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSaveDraft() {
    setSaving(true)
    setError(null)

    const stackArray = techStack
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const res = await safely(() => saveSubmissionDraft(hackathonId, teamId, {
      projectTitle: title,
      tagline,
      description,
      repoUrl: repoUrl || undefined,
      demoUrl: demoUrl || undefined,
      videoUrl: videoUrl || undefined,
      figmaUrl: figmaUrl || undefined,
      techStack: stackArray,
      selectedTracks: tracks,
    }))

    setSaving(false)
    if (res.ok) {
      setSuccess('Draft autosaved successfully.')
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  async function handleSubmitFinal(e: React.FormEvent) {
    e.preventDefault()
    if (!confirm('Are you ready to submit your project? Once submitted, it will be locked for judging.')) {
      return
    }

    setSubmitting(true)
    setError(null)

    // Save current values first
    const stackArray = techStack
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const saveRes = await safely(() => saveSubmissionDraft(hackathonId, teamId, {
      projectTitle: title,
      tagline,
      description,
      repoUrl: repoUrl || undefined,
      demoUrl: demoUrl || undefined,
      videoUrl: videoUrl || undefined,
      figmaUrl: figmaUrl || undefined,
      techStack: stackArray,
      selectedTracks: tracks,
    }))

    if (!saveRes.ok) {
      setSubmitting(false)
      setError(saveRes.error)
      return
    }

    const res = await safely(() => submitProject(hackathonId, teamId))
    setSubmitting(false)

    if (res.ok) {
      setSuccess('Project submitted successfully! Good luck in the judging round!')
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  if (isSubmitted) {
    return (
      <div className="rounded-2xl border border-[var(--color-positive)]/30 bg-[var(--color-positive-wash)] p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--color-positive)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-positive)]">
            Project Submitted &amp; Locked for Evaluation
          </span>
        </div>
        <h3 className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
          {initialSubmission?.projectTitle}
        </h3>
        <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
          {initialSubmission?.tagline}
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-ink-muted)]">
          {initialSubmission?.repoUrl && (
            <a
              href={initialSubmission.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-signal)] underline underline-offset-4"
            >
              GitHub Repository ↗
            </a>
          )}
          {initialSubmission?.demoUrl && (
            <a
              href={initialSubmission.demoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-signal)] underline underline-offset-4"
            >
              Live Demo ↗
            </a>
          )}
          {initialSubmission?.videoUrl && (
            <a
              href={initialSubmission.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-signal)] underline underline-offset-4"
            >
              Demo Video ↗
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--color-line)]/60 pb-4">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Project Submission Workspace
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
            Collaboratively prepare your project details, repo links, and demo video.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving || !isSubmissionsOpen}
          >
            {saving ? 'Autosaving...' : '💾 Save Draft'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[var(--color-critical)]/30 bg-[var(--color-critical)]/10 p-3 text-xs text-[var(--color-critical)]">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl border border-[var(--color-positive)]/30 bg-[var(--color-positive-wash)] p-3 text-xs text-[var(--color-positive)]">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmitFinal} className="mt-6 flex flex-col gap-5">
        <div>
          <label className="text-xs font-semibold text-[var(--color-ink)]">
            Project Title *
          </label>
          <Input
            placeholder="e.g. MedVision AI"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={!isSubmissionsOpen}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--color-ink)]">
            One-line Pitch / Tagline *
          </label>
          <Input
            placeholder="e.g. Autonomous diagnostics for rural clinics with offline LLMs"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            required
            disabled={!isSubmissionsOpen}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--color-ink)]">
            Problem &amp; Solution Overview
          </label>
          <Textarea
            placeholder="Describe what you built, how it works, challenges overcome, and future roadmap..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            disabled={!isSubmissionsOpen}
            className="mt-1"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Source Code Repository (GitHub / GitLab) *
            </label>
            <Input
              placeholder="https://github.com/..."
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              required
              disabled={!isSubmissionsOpen}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Live Demo / Deployed URL
            </label>
            <Input
              placeholder="https://my-project.vercel.app"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              disabled={!isSubmissionsOpen}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Video Demonstration (YouTube / Loom)
            </label>
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              disabled={!isSubmissionsOpen}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-ink)]">
              Design Prototype (Figma)
            </label>
            <Input
              placeholder="https://figma.com/file/..."
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              disabled={!isSubmissionsOpen}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--color-ink)]">
            Technologies Used (comma separated)
          </label>
          <Input
            placeholder="e.g. Next.js, PostgreSQL, TailwindCSS, PyTorch, ESP32"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
            disabled={!isSubmissionsOpen}
            className="mt-1"
          />
        </div>

        {availableTracks.length > 0 && (
          <div>
            <label className="text-xs font-semibold text-[var(--color-ink)] mb-1 block">
              Participating Prize Tracks &amp; Bounties
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTracks.map((track) => (
                <label
                  key={track.id}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer ${
                    tracks.includes(track.id)
                      ? 'border-[var(--color-signal)] bg-[var(--color-signal-wash)] text-[var(--color-signal)] font-medium'
                      : 'border-[var(--color-line)] bg-white text-[var(--color-ink-soft)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tracks.includes(track.id)}
                    disabled={!isSubmissionsOpen}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTracks([...tracks, track.id])
                      } else {
                        setTracks(tracks.filter((t) => t !== track.id))
                      }
                    }}
                    className="sr-only"
                  />
                  <span>{track.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[var(--color-line)]/60 pt-4">
          <p className="text-xs text-[var(--color-ink-muted)]">
            {!isSubmissionsOpen
              ? 'Submissions are currently locked.'
              : 'Draft is saved automatically to the team workspace.'}
          </p>

          <Button type="submit" disabled={submitting || !isSubmissionsOpen} size="sm">
            {submitting ? 'Submitting...' : '🚀 Final Submit Project'}
          </Button>
        </div>
      </form>
    </div>
  )
}
