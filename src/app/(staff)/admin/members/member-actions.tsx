'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STAFF_ROLES = [
  { value: '', label: 'Not staff' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'content_admin', label: 'Content admin' },
  { value: 'program_manager', label: 'Program manager' },
  { value: 'startup_manager', label: 'Startup manager' },
  { value: 'mentor_manager', label: 'Mentor manager' },
  { value: 'lab_admin', label: 'Lab admin' },
  { value: 'super_admin', label: 'Super admin' },
]

/**
 * Deactivate or reactivate an account, and set its staff role. Both end the person's sessions, and
 * both are recorded in the audit trail by the server. A super admin cannot change their own row
 * (the server refuses; the controls are disabled here so it is not offered).
 */
export function MemberActions({ id, isActive, staffRole, isSelf }: { id: string; isActive: boolean; staffRole: string | null; isSelf: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(path: string, body: unknown) {
    setPending(true)
    setError(null)
    const res = await fetch(`/api/admin/members/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setPending(false)
    if (!res?.ok) {
      setError(data?.error ?? 'That did not save.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Staff role"
          defaultValue={staffRole ?? ''}
          disabled={pending || isSelf}
          onChange={(e) => call('staff-role', { staffRole: e.target.value || null })}
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-2 text-[length:var(--text-small)]"
        >
          {STAFF_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || isSelf}
          onClick={() => call('active', { isActive: !isActive })}
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-[length:var(--text-small)] font-medium"
        >
          {isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
      {isSelf && <span className="text-xs text-[var(--color-ink-muted)]">This is your own account.</span>}
      {error && (
        <span role="alert" className="text-xs text-[var(--color-critical)]">
          {error}
        </span>
      )}
    </div>
  )
}
