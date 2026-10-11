'use client'

import { useState } from 'react'
import { formRequest } from '@/lib/form-request'

/**
 * Ends the session on the server (the row is deleted, not only the cookie) and returns to the
 * home page. A full navigation, not a client transition, so nothing from the signed-in session
 * is left in the router cache.
 */
export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function logout() {
    setPending(true)
    setError(null)
    const response = await formRequest('/api/auth/password/logout', { method: 'POST' })
    if (!response.ok) {
      setPending(false)
      setError('We couldn’t log you out. Check your connection and try again.')
      return
    }
    window.location.assign('/')
  }

  return (
    <span>
    <button type="button" onClick={logout} disabled={pending} aria-busy={pending} className={className}>
      {pending ? 'Logging out…' : 'Log out'}
    </button>
    {error && <span role="alert" className="block text-sm text-[var(--color-critical)]">{error}</span>}
    </span>
  )
}
