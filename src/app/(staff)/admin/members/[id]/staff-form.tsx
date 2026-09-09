'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Select } from '@/components/ui'

const ROLES = [
  { value: '', label: 'No staff access' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'content_admin', label: 'Content admin' },
  { value: 'program_manager', label: 'Program manager' },
  { value: 'startup_manager', label: 'Startup manager' },
  { value: 'mentor_manager', label: 'Mentor manager' },
  { value: 'super_admin', label: 'Super admin' },
]

/**
 * The first way in this product's history to grant staff access without SQL.
 *
 * Deliberately plain: a select and a button, no confirmation dialog, because
 * there is no Dialog primitive in this codebase and inventing one for this
 * would be the wrong place to start. The audit row is the safety net.
 */
export function StaffRoleForm({
  userId,
  current,
  canEdit,
}: {
  userId: string
  current: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [role, setRole] = useState(current ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canEdit) {
    return (
      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        Only a super admin can change staff access.
      </p>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch(`/api/admin/members/${userId}/staff-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffRole: role || null }),
    })
    setPending(false)
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error ?? 'Something went wrong.')
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[length:var(--text-small)] font-medium">Staff access</span>
        <Select value={role} onChange={(event) => setRole(event.target.value)}>
          {ROLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save access'}
      </Button>
      {error && (
        <p role="alert" className="text-[length:var(--text-small)] text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </form>
  )
}

/**
 * Turning an account off.
 *
 * `users.isActive` was read by the auth strategy on every request and written
 * by nothing, so a departed or compromised account could only be dealt with in
 * SQL. Sessions are database-backed and roles are re-read per request, so this
 * takes hold on the account's next request rather than when a token expires.
 */
export function AccountStatusForm({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch(`/api/admin/members/${userId}/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    setPending(false)
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error ?? 'Something went wrong.')
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <p className="text-[length:var(--text-small)] font-medium">Account</p>
        <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {isActive
            ? 'Active. Deactivating signs them out on their next request.'
            : 'Deactivated. They cannot sign in.'}
        </p>
      </div>
      <Button type="submit" variant={isActive ? 'danger' : 'secondary'} disabled={pending}>
        {pending ? 'Saving…' : isActive ? 'Deactivate account' : 'Reactivate account'}
      </Button>
      {error && (
        <p role="alert" className="text-[length:var(--text-small)] text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </form>
  )
}
