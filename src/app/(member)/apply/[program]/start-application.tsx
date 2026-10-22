'use client'

import { formRequest } from '@/lib/form-request'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Heading } from '@/components/ui'
import type { ApplicationQuestion } from '@/server/applications/types'

/**
 * Starting an application is a deliberate act. It used to happen as a side
 * effect of loading this page, so a prefetch, a crawler or a mistyped link
 * created a draft in someone's name (R-06).
 */
export function StartApplication({ programSlug, programTitle, questions }: { programSlug: string; programTitle: string; questions: ApplicationQuestion[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setPending(true)
    setError(null)
    const res = await formRequest('/api/applications/start', {
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
      <p className="mt-4 text-[var(--color-ink-soft)]">{questions.length} questions · {questions.filter((question) => question.required !== false).length} required. Your progress is saved when you continue.</p>
      {questions.some((question) => question.fieldType === 'file') && (
        <div className="mt-5 rounded-lg border border-[var(--color-line)] p-4">
          <p className="font-semibold">Have these documents ready</p>
          <ul className="mt-2 list-disc pl-5">{questions.filter((question) => question.fieldType === 'file').map((question) => <li key={question.id}>{question.label}{question.required === false ? ' (optional)' : ' (required)'}</li>)}</ul>
          <p className="mt-2 text-sm">PDF, DOC or PPT · up to 10 MB per file.</p>
        </div>
      )}
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
