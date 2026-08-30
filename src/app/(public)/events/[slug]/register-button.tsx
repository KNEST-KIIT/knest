'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui'

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
  const toast = useToast()

  async function toggle() {
    setPending(true)
    const endpoint = registered ? 'unregister' : 'register'
    const res = await fetch(`/api/events/${eventId}/${endpoint}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setPending(false)

    if (res.status === 401) {
      router.push(`/signup?next=${encodeURIComponent(`/events/${slug}`)}`)
      return
    }
    if (!res.ok) {
      toast({
        tone: 'error',
        title: registered ? 'Could not cancel' : 'Could not register',
        description: data.error ?? 'Something went wrong. Nothing has changed.',
      })
      return
    }
    // Confirm the outcome by name. "Register" flipping to "Cancel
    // registration" is evidence, but it is evidence you have to notice.
    toast({
      tone: 'success',
      title: registered ? 'Registration cancelled' : "You're registered",
      description: registered ? undefined : 'It will show up on your dashboard.',
    })
    setRegistered((r) => !r)
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
      <Button
        onClick={toggle}
        pending={pending}
        pendingLabel="Saving"
        fullWidth
        size="lg"
        variant={registered ? 'secondary' : 'primary'}
      >
        {registered ? 'Cancel registration' : 'Register'}
      </Button>
    </div>
  )
}
