'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Textarea } from '@/components/ui'
import {
  createTeam,
  disbandTeam,
  joinTeamByCode,
  leaveTeam,
  registerForHackathon,
  transferLeadership,
} from '@/server/hackathons/actions'

export function HackathonTeamActions({
  hackathonId,
  isRegistered,
  myTeam,
  currentUserId,
  availableTracks,
  canCreateTeam,
}: {
  hackathonId: string
  isRegistered: boolean
  myTeam: {
    id: string
    name: string
    joinCode: string
    leaderId?: string | null
    selectedTracks: string[]
    techStack: string[]
    members: { role: string; user: { id: string; name: string | null } }[]
  } | null
  currentUserId?: string | null
  availableTracks: { id: string; name: string }[]
  canCreateTeam: boolean
}) {
  const router = useRouter()
  const [modal, setModal] = useState<
    'create' | 'join' | 'register' | 'transfer' | 'disband' | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [targetLeaderId, setTargetLeaderId] = useState('')

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

  const isLeader = Boolean(
    myTeam &&
      currentUserId &&
      (myTeam.leaderId === currentUserId ||
        myTeam.members.find((m) => m.user.id === currentUserId)?.role === 'leader'),
  )

  const otherMembers =
    myTeam?.members.filter((m) => m.user.id !== currentUserId) ?? []

  async function handleCopyCode() {
    if (!myTeam?.joinCode) return
    try {
      await navigator.clipboard.writeText(myTeam.joinCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      // Fallback
    }
  }

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

  async function handleDisbandTeam() {
    setLoading(true)
    setError(null)

    const res = await disbandTeam(hackathonId)
    setLoading(false)
    if (res.ok) {
      setSuccess('Team disbanded successfully.')
      setModal(null)
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  async function handleTransferLeadership(e: React.FormEvent) {
    e.preventDefault()
    if (!targetLeaderId) return
    setLoading(true)
    setError(null)

    const res = await transferLeadership(hackathonId, targetLeaderId)
    setLoading(false)
    if (res.ok) {
      setSuccess('Leadership transferred successfully.')
      setModal(null)
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

      {/* Action Buttons Bar when not in a team */}
      {!myTeam && (
        <div className="flex flex-wrap items-center gap-3">
          {!isRegistered ? (
            <Button onClick={() => setModal('register')} size="sm">
              ✨ Register for Hackathon
            </Button>
          ) : canCreateTeam ? (
            <>
              <Button onClick={() => setModal('create')} size="sm">
                🚀 Create a Team
              </Button>
              <Button onClick={() => setModal('join')} variant="secondary" size="sm">
                🔑 Join with 6-Digit Code
              </Button>
            </>
          ) : null}
        </div>
      )}

      {/* Institutional Squad Card when member is in a team */}
      {myTeam && (
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)]/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-signal-wash)] text-lg">
                🛡️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
                    {myTeam.name}
                  </span>
                  <span className="rounded-full bg-[var(--color-positive-wash)] px-2.5 py-0.5 text-[length:var(--text-micro)] font-bold text-[var(--color-positive)]">
                    {myTeam.members.length}{' '}
                    {myTeam.members.length === 1 ? 'member' : 'members'}
                  </span>
                  {isLeader && (
                    <span className="rounded-full bg-[var(--color-signal-wash)] px-2.5 py-0.5 text-[length:var(--text-micro)] font-bold text-[var(--color-signal)]">
                      Team Captain
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
                  Share your squad join code with peers to invite them to this sprint.
                </p>
              </div>
            </div>

            {/* Join Code Badge with 1-click Copy */}
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-1.5 pl-3">
              <span className="text-[length:var(--text-micro)] font-medium text-[var(--color-ink-muted)]">
                Invite Code:
              </span>
              <span className="font-mono text-xs font-bold tracking-wider text-[var(--color-ink)]">
                {myTeam.joinCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-1 text-[length:var(--text-micro)] font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper-soft)]"
                title="Copy Join Code"
              >
                {copiedCode ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Squad Members Roster & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[length:var(--text-micro)] font-bold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Roster:
              </span>
              {myTeam.members.map((m) => (
                <span
                  key={m.user.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-soft)] px-2.5 py-1 text-xs text-[var(--color-ink)]"
                >
                  <span>{m.user.name || 'Anonymous Hacker'}</span>
                  {m.role === 'leader' && (
                    <span className="rounded bg-[var(--color-signal)] px-1 py-0.2 text-[length:var(--text-micro)] font-bold text-white">
                      Captain
                    </span>
                  )}
                  {m.user.id === currentUserId && (
                    <span className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
                      (You)
                    </span>
                  )}
                </span>
              ))}
            </div>

            {/* Squad Management Action Buttons */}
            <div className="flex items-center gap-2">
              {isLeader ? (
                <>
                  {otherMembers.length > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setTargetLeaderId(otherMembers[0]?.user.id ?? '')
                        setModal('transfer')
                      }}
                      disabled={loading}
                    >
                      Delegate Captain
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setModal('disband')}
                    disabled={loading}
                  >
                    Disband Squad
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleLeaveTeam}
                  disabled={loading}
                >
                  Leave Squad
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setModal(null)}
              >
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setModal(null)}
              >
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Joining...' : 'Join Team'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Disband Team Modal */}
      {modal === 'disband' && (
        <div className="rounded-2xl border border-[var(--color-critical)]/40 bg-[var(--color-paper-raised)] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[var(--color-critical)]">
            <span className="text-lg">⚠️</span>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">
              Disband Squad &quot;{myTeam?.name}&quot;?
            </h3>
          </div>
          <p className="mt-2 text-xs text-[var(--color-ink-soft)] leading-relaxed">
            This action cannot be undone. Any draft project submission will be deleted, and all members
            will be released to join other teams or register a new squad.
          </p>

          <div className="mt-6 flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setModal(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDisbandTeam}
              disabled={loading}
            >
              {loading ? 'Disbanding...' : 'Confirm Disband'}
            </Button>
          </div>
        </div>
      )}

      {/* Transfer Leadership Modal */}
      {modal === 'transfer' && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-sm">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Delegate Squad Captain Role
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            Select an active squad member to become the new Team Captain. You will remain on the team as a member.
          </p>

          <form onSubmit={handleTransferLeadership} className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--color-ink)]">
                Select New Captain
              </label>
              <select
                value={targetLeaderId}
                onChange={(e) => setTargetLeaderId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-xs text-[var(--color-ink)] focus:outline-hidden focus:ring-2 focus:ring-[var(--color-signal)]"
                required
              >
                {otherMembers.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name || 'Anonymous Hacker'} ({m.user.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading || !targetLeaderId}>
                {loading ? 'Transferring...' : 'Confirm Transfer'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
