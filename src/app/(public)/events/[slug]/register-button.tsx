'use client'

import { formRequest } from '@/lib/form-request'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function RegisterButton({
  eventId,
  slug,
  initiallyRegistered,
  full,
}: {
  eventId: number
  slug: string
  initiallyRegistered: boolean
  full: boolean
}) {
  const router = useRouter()
  const [registered, setRegistered] = useState(initiallyRegistered)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  async function toggle() {
    setPending(true)
    setError(null)
    setConfirmation(null)
    const endpoint = registered ? 'unregister' : 'register'
    const res = await formRequest(`/api/events/${eventId}/${endpoint}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setPending(false)

    if (res.status === 401) {
      router.push(`/signup?next=${encodeURIComponent(`/events/${slug}`)}`)
      return
    }
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      return
    }
    setRegistered((r) => !r)
    setConfirmation(registered ? 'Your registration is cancelled.' : 'You’re registered. Your event details are saved in Your events.')
    router.refresh()
  }

  if (full && !registered) {
    return (
      <div>
        <Button disabled fullWidth size="lg">
          Event full
        </Button>
        <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          This event has reached capacity.
        </p>
      </div>
    )
  }

  return (
    <div>
      <Button onClick={toggle} disabled={pending} fullWidth size="lg" variant={registered ? 'secondary' : 'primary'}>
        {pending ? 'Saving…' : registered ? 'Cancel registration' : 'Register'}
      </Button>
      {error && <p role="alert" className="mt-2 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}
      {confirmation && <p role="status" className="mt-3 text-sm">{confirmation}</p>}
      {registered && <a href="/dashboard/events" className="mt-3 inline-block text-sm text-[var(--color-signal)] underline">Your events</a>}
    </div>
  )
}
