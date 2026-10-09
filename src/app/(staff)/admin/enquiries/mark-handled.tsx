'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MarkHandled({ id }: { id: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function mark() {
    setPending(true)
    setError(null)
    const res = await fetch(`/api/admin/enquiries/${id}/handled`, { method: 'POST' }).catch(() => null)
    if (!res?.ok) {
      setError('That did not save. Try again.')
      setPending(false)
      return
    }
    router.refresh()
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={mark}
        disabled={pending}
        aria-busy={pending}
        className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-[length:var(--text-small)] font-medium"
      >
        {pending ? 'Saving…' : 'Mark handled'}
      </button>
      {error && (
        <span role="alert" className="text-xs text-[var(--color-critical)]">
          {error}
        </span>
      )}
    </span>
  )
}
