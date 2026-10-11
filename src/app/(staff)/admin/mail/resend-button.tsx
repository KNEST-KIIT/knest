'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formRequest } from '@/lib/form-request'

export function ResendButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resend() {
    setPending(true)
    setError(null)
    const res = await formRequest(`/api/admin/mail/${id}/resend`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'That did not go. Try again.')
      setPending(false)
      return
    }
    router.refresh()
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={resend}
        disabled={pending}
        aria-busy={pending}
        className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-[length:var(--text-small)] font-medium"
      >
        {pending ? 'Resending…' : 'Resend'}
      </button>
      {error && (
        <span role="alert" className="text-xs text-[var(--color-critical)]">
          {error}
        </span>
      )}
    </span>
  )
}
