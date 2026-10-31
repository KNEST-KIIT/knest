'use client'

import { useState } from 'react'
import { formRequest } from '@/lib/form-request'
import { Button } from '@/components/ui/button'

const COMMON_SKILLS = [
  'Full-stack Web',
  'Next.js / React',
  'Python',
  'AI / LLM Agents',
  'Mobile (Flutter / RN)',
  'Embedded & IoT',
  'Robotics',
  'Product Design',
  'Financial Modeling',
  'Growth & GTM',
  'BioTech',
  'Hardware CAD',
]

type ProfileData = {
  name: string
  email: string
  bio: string
  school: string
  graduationYear: number | null
  linkedinUrl: string
  websiteUrl: string
  skills: string[]
  platformRole: string
  journeyStage: string | null
}

export function ProfileEditor({ initialProfile }: { initialProfile: ProfileData }) {
  const [profile, setProfile] = useState<ProfileData>(initialProfile)
  const [newSkill, setNewSkill] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function addSkill(skill: string) {
    const trimmed = skill.trim()
    if (!trimmed || profile.skills.includes(trimmed)) return
    if (profile.skills.length >= 15) return
    setProfile((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }))
    setNewSkill('')
  }

  function removeSkill(skillToRemove: string) {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setMessage(null)
    setError(null)

    try {
      const res = await formRequest('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          bio: profile.bio,
          school: profile.school,
          graduationYear: profile.graduationYear ? Number(profile.graduationYear) : null,
          linkedinUrl: profile.linkedinUrl || null,
          websiteUrl: profile.websiteUrl || null,
          skills: profile.skills,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not update profile.')
      } else {
        setMessage('Your builder profile is live and up to date!')
        setTimeout(() => setMessage(null), 4000)
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const initials = profile.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'KB'

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-12">
      {/* Live Builder Card Preview */}
      <div className="lg:col-span-5">
        <div className="sticky top-6 rounded-2xl border border-[var(--color-line)] bg-gradient-to-b from-white to-[var(--color-paper-soft)]/60 p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--color-line)]/60 pb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-signal)]">
              Builder Card Preview
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Builder
            </span>
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-ink)] text-base font-bold text-[var(--color-paper)] shadow-inner">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
                {profile.name || 'Anonymous Builder'}
              </h3>
              <p className="truncate text-xs font-medium text-[var(--color-ink-soft)]">
                {profile.school || 'KIIT University'}
                {profile.graduationYear ? ` · Class of '${String(profile.graduationYear).slice(-2)}` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="inline-block rounded-[var(--radius-sm)] bg-[var(--color-signal)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-signal)]">
                  {profile.platformRole}
                </span>
                {profile.journeyStage && (
                  <span className="inline-block rounded-[var(--radius-sm)] bg-[var(--color-ink)]/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    {profile.journeyStage}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs leading-relaxed text-[var(--color-ink-soft)]">
            {profile.bio || 'Add a bio describing what you are building, your domain interests, and what you want to achieve.'}
          </div>

          {/* Skills tags preview */}
          <div className="mt-5 border-t border-[var(--color-line)]/60 pt-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-muted)]">
              Core Skills &amp; Stack
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.skills.length > 0 ? (
                profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center rounded-md border border-[var(--color-line)] bg-white px-2 py-0.5 text-xs font-medium text-[var(--color-ink)] shadow-2xs"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-xs italic text-[var(--color-ink-muted)]">No skills added yet</span>
              )}
            </div>
          </div>

          {/* Social links preview */}
          {(profile.linkedinUrl || profile.websiteUrl) && (
            <div className="mt-4 flex items-center gap-3 border-t border-[var(--color-line)]/60 pt-3 text-xs">
              {profile.linkedinUrl && (
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--color-signal)] hover:underline"
                >
                  LinkedIn ↗
                </a>
              )}
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--color-signal)] hover:underline"
                >
                  Portfolio / GitHub ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Studio Editor Form */}
      <div className="lg:col-span-7">
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
                Builder Profile Studio
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                Keep your campus founder and talent profile updated.
              </p>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-800">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)]">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal)]"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)]">
                  School / Department / Campus
                </label>
                <input
                  type="text"
                  placeholder="e.g. School of Computer Engineering"
                  value={profile.school}
                  onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)]">
                  Expected Graduation Year
                </label>
                <input
                  type="number"
                  placeholder="2026"
                  min="2020"
                  max="2035"
                  value={profile.graduationYear || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      graduationYear: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)]">
                Bio &amp; Mission
              </label>
              <textarea
                rows={3}
                placeholder="What are you building or interested in building? Tell founders, mentors, and peers."
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal)]"
              />
              <span className="text-[10px] text-[var(--color-ink-muted)]">
                {profile.bio.length} / 500 characters
              </span>
            </div>

            {/* Skills manager */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)]">
                Superpowers &amp; Tech Stack (Skills)
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  placeholder="Add a skill (e.g. PyTorch, Next.js, CAD)..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill(newSkill)
                    }
                  }}
                  className="flex-1 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal)]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => addSkill(newSkill)}
                >
                  Add
                </Button>
              </div>

              {/* Suggestions */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[var(--color-ink-muted)]">Suggestions:</span>
                {COMMON_SKILLS.filter((s) => !profile.skills.includes(s))
                  .slice(0, 6)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSkill(s)}
                      className="rounded bg-[var(--color-paper-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-signal)]/10 hover:text-[var(--color-signal)] transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
              </div>

              {/* Active Skill Pills with Remove */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-soft)]/60 px-2.5 py-1 text-xs font-medium text-[var(--color-ink)]"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="text-[var(--color-ink-muted)] hover:text-red-600 transition-colors"
                      title="Remove skill"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)]">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={profile.linkedinUrl}
                  onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)]">
                  Portfolio / GitHub / X URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/username"
                  value={profile.websiteUrl}
                  onChange={(e) => setProfile({ ...profile, websiteUrl: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-signal)] focus:outline-none focus:ring-1 focus:ring-[var(--color-signal)]"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end border-t border-[var(--color-line)] pt-4">
            <Button type="submit" disabled={pending} className="min-w-28 font-semibold">
              {pending ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

