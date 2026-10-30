'use client'

import { formRequest } from '@/lib/form-request'

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
  const [selectedRole, setSelectedRole] = useState(staffRole ?? '')
  const [confirmingAction, setConfirmingAction] = useState<'role' | 'active' | null>(null)

  const selectedRoleLabel = STAFF_ROLES.find((r) => r.value === selectedRole)?.label ?? selectedRole

  async function call(path: string, body: unknown) {
    setPending(true)
    setError(null)
    const res = await formRequest(`/api/admin/members/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setPending(false)
    setConfirmingAction(null)
    if (!res?.ok) {
      setError(data?.error ?? 'That did not save.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-start gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          aria-label="Staff role"
          value={selectedRole}
          disabled={pending || isSelf}
          onChange={(e) => {
            setSelectedRole(e.target.value)
            setConfirmingAction(null)
          }}
          className="h-11 min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-[length:var(--text-small)]"
        >
          {STAFF_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || isSelf || selectedRole === (staffRole ?? '')}
          onClick={() => setConfirmingAction('role')}
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-4 text-[length:var(--text-small)] font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-soft)] disabled:opacity-50 transition-colors"
        >
          Apply role
        </button>
        <button
          type="button"
          disabled={pending || isSelf}
          onClick={() => setConfirmingAction('active')}
          className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-4 text-[length:var(--text-small)] font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-soft)] disabled:opacity-50 transition-colors"
        >
          {isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>

      {confirmingAction === 'active' && (
        <div role="alertdialog" aria-modal="false" aria-labelledby={`account-action-title-${id}`} aria-describedby={`account-action-description-${id}`} className="flex w-full max-w-md flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-critical)] bg-[var(--color-paper-soft)] p-3 text-xs text-[var(--color-critical)]">
          <p id={`account-action-title-${id}`} className="font-semibold">
            Confirm {isActive ? 'account deactivation' : 'account reactivation'}
          </p>
          <p id={`account-action-description-${id}`} className="text-[var(--color-ink)]">
            {isActive
              ? 'This will immediately terminate all active sessions and block sign-in for this user.'
              : 'This will restore sign-in access for this user.'}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => call('active', { isActive: !isActive })}
              className={`inline-flex h-11 min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] px-4 font-semibold text-white ${isActive ? 'bg-[var(--color-critical)] hover:brightness-90' : 'bg-[var(--color-signal)] hover:bg-[var(--color-signal-deep)]'} transition-colors`}
            >
              {pending ? 'Saving…' : `Yes, ${isActive ? 'deactivate' : 'reactivate'}`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmingAction(null)}
              className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-4 font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-soft)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmingAction === 'role' && (
        <div role="alertdialog" aria-modal="false" aria-labelledby={`role-action-title-${id}`} aria-describedby={`role-action-description-${id}`} className="flex w-full max-w-md flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-signal)] bg-[var(--color-paper-soft)] p-3 text-xs text-[var(--color-signal)]">
          <p id={`role-action-title-${id}`} className="font-semibold">
            Confirm privileged role change
          </p>
          <p id={`role-action-description-${id}`} className="text-[var(--color-ink)]">
            Change staff role to <strong className="text-[var(--color-signal)]">{selectedRoleLabel}</strong>? This modifies permissions and terminates active sessions.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => call('staff-role', { staffRole: selectedRole || null })}
              className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-signal)] hover:bg-[var(--color-signal-deep)] px-4 font-semibold text-white transition-colors"
            >
              {pending ? 'Applying…' : 'Yes, apply role'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmingAction(null)}
              className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-4 font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-soft)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isSelf && <span className="text-xs text-[var(--color-ink-muted)]">This is your own account.</span>}
      {error && (
        <span role="alert" className="text-xs text-[var(--color-critical)]">
          {error}
        </span>
      )}
    </div>
  )
}
