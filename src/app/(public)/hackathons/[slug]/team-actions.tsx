'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Textarea } from '@/components/ui'
import {
  createTeam,
  joinTeamByCode,
  leaveTeam,
  registerForHackathon,
} from '@/server/hackathons/actions'

export function HackathonTeamActions({
  hackathonId,
  isRegistered,
  myTeam,
  availableTracks,
  canCreateTeam,
}: {
  hackathonId: string
  isRegistered: boolean
  myTeam: {
    id: string
    name: string
    joinCode: string
    selectedTracks: string[]
    techStack: string[]
    members: { role: string; user: { id: string; name: string | null } }[]
  } | null
  availableTracks: { id: string; name: string }[]
  canCreateTeam: boolean
}) {
  const router = useRouter()
  const [modal, setModal] = useState<'create' | 'join' | 'register' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Registration state
  const [regLookingForTeam, setRegLookingForTeam] = useState(true)
  const [regSkills, setRegSkills] = useState('')

  // Create team state
  const [teamName, setTeamName] = useState('')
  const [teamTracks, setTeamTracks] = useState<string[]>([])
  const [teamStack, setTeamStack] = useState('')
  const [recruitmentPitch, setRecruitmentPitch] = useState('')

  // Join team state
  const [joinCode, setJoinCode] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const skillsArray = regSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const res = await registerForHackathon(hackathonId, {
      lookingForTeam: regLookingForTeam,
      skills: skillsArray,
    })

    setLoading(false)
    if (res.ok) {
      setSuccess('You are now registered for this hackathon!')
      setModal(null)
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const stackArray = teamStack
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const res = await createTeam(hackathonId, {
      name: teamName,
      selectedTracks: teamTracks,
      techStack: stackArray,
      recruitmentPitch,
    })

    setLoading(false)
    if (res.ok) {
      setSuccess('Team created successfully!')
      setModal(null)
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  async function handleJoinTeam(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await joinTeamByCode(hackathonId, joinCode)

    setLoading(false)
    if (res.ok) {
      setSuccess('Joined team successfully!')
      setModal(null)
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  async function handleLeaveTeam() {
    if (!confirm('Are you sure you want to leave this team?')) return
    setLoading(true)
    setError(null)

    const res = await leaveTeam(hackathonId)
    setLoading(false)
    if (res.ok) {
      setSuccess('Left team.')
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="flex flex-col gap-4">
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

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {!isRegistered ? (
          <Button onClick={() => setModal('register')} size="sm">
            ✨ Register for Hackathon
          </Button>
        ) : !myTeam && canCreateTeam ? (
          <>
            <Button onClick={() => setModal('create')} size="sm">
              🚀 Create a Team
            </Button>
            <Button onClick={() => setModal('join')} variant="secondary" size="sm">
              🔑 Join with 6-Digit Code
            </Button>
          </>
        ) : null}

        {myTeam && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-ink-muted)]">
              Your Team: <strong>{myTeam.name}</strong>
            </span>
            <span className="font-mono text-xs rounded bg-[var(--color-paper-soft)] px-2 py-0.5 border border-[var(--color-line)]">
              Code: {myTeam.joinCode}
            </span>
            <button
              onClick={handleLeaveTeam}
              disabled={loading}
              className="text-xs text-[var(--color-critical)] hover:underline ml-2"
            >
              Leave
            </button>
          </div>
        )}
      </div>

      {/* Register Modal */}
      {modal === 'register' && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-sm">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Register for Hackathon
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            One-click RSVP using your KNEST verified profile.
          </p>

          <form onSubmit={handleRegister} className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--color-ink)]">
                Skills / Expertise (comma separated)
              </label>
              <Input
                placeholder="e.g. Next.js, Rust, IoT, Product Design"
                value={regSkills}
                onChange={(e) => setRegSkills(e.target.value)}
                className="mt-1"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[var(--color-ink)] cursor-pointer">
              <input
                type="checkbox"
                checked={regLookingForTeam}
                onChange={(e) => setRegLookingForTeam(e.target.checked)}
                className="accent-[var(--color-signal)]"
              />
              <span>List me on the Team Directory (looking for teammates)</span>
            </label>

            <div className="flex items-center gap-2 justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Confirming...' : 'Complete RSVP'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Create Team Modal */}
      {modal === 'create' && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-sm">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Create Your Hackathon Team
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            You will become the Team Leader. You can invite members using a unique 6-character code.
          </p>

          <form onSubmit={handleCreateTeam} className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--color-ink)]">
                Team Name *
              </label>
              <Input
                placeholder="e.g. NeuralVoyagers"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-ink)]">
                Tech Stack (comma separated)
              </label>
              <Input
                placeholder="e.g. Python, PyTorch, React, WebSockets"
                value={teamStack}
                onChange={(e) => setTeamStack(e.target.value)}
                className="mt-1"
              />
            </div>

            {availableTracks.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-[var(--color-ink)] mb-1 block">
                  Target Tracks
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTracks.map((track) => (
                    <label
                      key={track.id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                        teamTracks.includes(track.id)
                          ? 'border-[var(--color-signal)] bg-[var(--color-signal-wash)] text-[var(--color-signal)] font-medium'
                          : 'border-[var(--color-line)] bg-white text-[var(--color-ink-soft)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={teamTracks.includes(track.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTeamTracks([...teamTracks, track.id])
                          } else {
                            setTeamTracks(teamTracks.filter((t) => t !== track.id))
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

            <div>
              <label className="text-xs font-semibold text-[var(--color-ink)]">
                Recruitment Pitch (What roles are you looking for?)
              </label>
              <Textarea
                placeholder="Looking for a frontend designer who loves Framer or Tailwind..."
                value={recruitmentPitch}
                onChange={(e) => setRecruitmentPitch(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Creating...' : 'Create Team & Generate Join Code'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Join Team Modal */}
      {modal === 'join' && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-sm">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Join Team with Join Code
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            Enter the 6-character code provided by your team leader.
          </p>

          <form onSubmit={handleJoinTeam} className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--color-ink)]">
                Join Code
              </label>
              <Input
                placeholder="e.g. 7X8K2M"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
                maxLength={6}
                className="mt-1 font-mono tracking-widest uppercase text-base"
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Joining...' : 'Join Team'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
