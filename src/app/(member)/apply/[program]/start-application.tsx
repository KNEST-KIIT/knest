'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Heading } from '@/components/ui'

/**
 * Starting an application is a deliberate act. It used to happen as a side
 * effect of loading this page, so a prefetch, a crawler or a mistyped link
 * created a draft in someone's name (R-06).
 */
export function StartApplication({ programSlug, programTitle }: { programSlug: string; programTitle: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setPending(true)
    setError(null)
    const res = await fetch('/api/applications/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programSlug }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    if (!res?.ok) {
      setError(data?.error ?? 'We couldn’t start that application. Check your connection and try again.')
      setPending(false)
      return
    }
    router.refresh()
  }

  return (
    <section>
      <Heading as="h1" size="title">
        Apply to {programTitle}
      </Heading>
      <p className="mt-4 max-w-[60ch] text-[var(--color-ink-muted)]">
        Starting creates a draft that you can leave and come back to. Nothing is sent to the team until you submit it.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">
          {error}
        </p>
      )}
      <div className="mt-8">
        <Button onClick={start} disabled={pending} aria-busy={pending}>
          {pending ? 'Starting…' : 'Start application'}
        </Button>
      </div>
    </section>
  )
}
