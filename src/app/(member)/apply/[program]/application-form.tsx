'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, Heading, Input, LiveRegion, MultiSelect, SingleSelect, Textarea } from '@/components/ui'
import type { ApplicationQuestion } from '@/server/applications/types'

type Props = {
  applicationId: string
  programTitle: string
  questions: ApplicationQuestion[]
  initialAnswers: Record<string, unknown>
  initialDocuments: Record<string, string>
}

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

/**
 * One question per screen (UX_WIREFRAMES.md §9), the same rhythm onboarding
 * already established. Steps are the program's own question set — nothing
 * here is program-specific in code (spec §18).
 */
export function ApplicationForm({ applicationId, programTitle, questions, initialAnswers, initialDocuments }: Props) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers)
  const [documentNames, setDocumentNames] = useState<Record<string, string>>(initialDocuments)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const total = questions.length
  const question = questions[index]

  async function saveCurrent(): Promise<boolean> {
    if (!question) return true
    if (question.fieldType === 'file') return true // documents save on selection, not on continue

    setPending(true)
    setError(null)
    const result = await postJSON(`/api/applications/${applicationId}/answer`, {
      questionId: question.id,
      value: answers[question.id] ?? (question.fieldType === 'multiselect' ? [] : ''),
    })
    setPending(false)

    if (result.status === 401) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
      return false
    }
    if (!result.ok) {
      setError(result.data.error ?? 'Something went wrong.')
      return false
    }
    setLastSaved(new Date())
    return true
  }

  async function next() {
    const saved = await saveCurrent()
    if (!saved) return
    if (index === total - 1) setReviewing(true)
    else setIndex((i) => i + 1)
  }

  async function uploadFile(file: File) {
    if (!question) return
    setPending(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('questionId', question.id)
    const res = await fetch(`/api/applications/${applicationId}/documents`, { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setPending(false)

    if (res.status === 401) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
      return
    }
    if (!res.ok) {
      setError(data.error ?? 'That upload failed.')
      return
    }
    setDocumentNames((prev) => ({ ...prev, [question.id]: file.name }))
    setLastSaved(new Date())
  }

  async function submit() {
    setPending(true)
    setError(null)
    const res = await fetch(`/api/applications/${applicationId}/submit`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setPending(false)

    if (res.status === 401) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`
      return
    }
    if (!res.ok) {
      if (data.code === 'verify-required') {
        router.push(`/verify?next=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      setError(data.error ?? 'Something went wrong.')
      return
    }
    setSubmitted(true)
  }

  const canContinue = useMemo(() => {
    if (!question) return true
    if (question.required === false) return true
    if (question.fieldType === 'file') return Boolean(documentNames[question.id])
    const value = answers[question.id]
    if (question.fieldType === 'multiselect') return Array.isArray(value) && value.length > 0
    return typeof value === 'string' && value.trim().length > 0
  }, [question, answers, documentNames])

  if (submitted) {
    return (
      <div>
        <Heading as="h1" size="title">
          Your application is in.
        </Heading>
        <p className="mt-4 text-[var(--color-ink-soft)]">
          We&rsquo;ve got it. Here&rsquo;s what happens next: our team reads every application, and
          you&rsquo;ll hear from us. You can track the status any time from your dashboard. A confirmation is
          on its way to your inbox.
        </p>
        <div className="mt-8 flex gap-4">
          <Button onClick={() => router.push('/dashboard/applications')}>Track your application</Button>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (reviewing) {
    return (
      <div>
        <p className="mb-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">Before you submit</p>
        <Heading as="h1" size="title">
          Have a last look.
        </Heading>
        <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          You won&rsquo;t be able to edit after this.
        </p>

        <div className="mt-8 flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-start justify-between gap-4 py-4">
              <div>
                <p className="text-[length:var(--text-small)] font-medium text-[var(--color-ink-muted)]">{q.label}</p>
                <p className="mt-1">
                  {q.fieldType === 'file'
                    ? documentNames[q.id] || '—'
                    : Array.isArray(answers[q.id])
                      ? (answers[q.id] as string[]).join(', ') || '—'
                      : (answers[q.id] as string) || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReviewing(false)
                  setIndex(i)
                }}
                className="shrink-0 text-[length:var(--text-small)] font-medium text-[var(--color-signal)]"
              >
                Edit
              </button>
            </div>
          ))}
        </div>

        {error && <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}

        <div className="mt-8 flex gap-4">
          <button type="button" onClick={() => setReviewing(false)} className="text-[length:var(--text-small)] font-medium">
            ← Back
          </button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Submitting…' : 'Submit application'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            Apply to {programTitle} — Section {index + 1} of {total}
          </p>
        </div>
        {lastSaved && (
          <p className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">Saved automatically</p>
        )}
      </div>
      {/* Announced separately from the visible indicator above: the visible
          text alone doesn't reliably reach a screen reader user whose focus
          is still in the field they just filled in. */}
      <LiveRegion message={lastSaved ? 'Saved.' : ''} />
      <div className="h-1 w-full rounded-full bg-[var(--color-paper-soft)]">
        <div
          className="h-1 rounded-full bg-[var(--color-signal)] transition-[width] duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {question && (
        <div className="mt-8">
          <Heading as="h1" size="title">
            {question.label}
          </Heading>
          {question.helpText && <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{question.helpText}</p>}

          <div className="mt-6">
            {(question.fieldType === 'text' || question.fieldType === 'url') && (
              <Field label="Your answer" optional={question.required === false}>
                {(p) => (
                  <Input
                    {...p}
                    type={question.fieldType === 'url' ? 'url' : 'text'}
                    value={(answers[question.id] as string) ?? ''}
                    maxLength={question.maxLength ?? undefined}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                  />
                )}
              </Field>
            )}

            {question.fieldType === 'textarea' && (
              <Field label="Your answer" optional={question.required === false}>
                {(p) => (
                  <Textarea
                    {...p}
                    value={(answers[question.id] as string) ?? ''}
                    maxLength={question.maxLength ?? undefined}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                  />
                )}
              </Field>
            )}

            {question.fieldType === 'select' && (
              <SingleSelect
                options={(question.options ?? []).map((o) => ({ value: o.label, label: o.label }))}
                value={(answers[question.id] as string) ?? null}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [question.id]: v }))}
              />
            )}

            {question.fieldType === 'multiselect' && (
              <MultiSelect
                options={(question.options ?? []).map((o) => ({ value: o.label, label: o.label }))}
                value={(answers[question.id] as string[]) ?? []}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [question.id]: v }))}
              />
            )}

            {question.fieldType === 'file' && (
              <div>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-line)] px-6 py-10 text-center hover:border-[var(--color-signal)]">
                  <span className="text-[length:var(--text-small)]">
                    {documentNames[question.id] ? documentNames[question.id] : 'Drop a file, or choose one'}
                  </span>
                  <span className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
                    PDF, DOC or PPT. Up to 10 MB.
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadFile(file)
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {error && <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}

          <div className="mt-10 flex items-center justify-between">
            {index > 0 ? (
              <button type="button" onClick={() => setIndex((i) => i - 1)} className="text-[length:var(--text-small)] font-medium">
                ← Back
              </button>
            ) : (
              <span />
            )}
            <Button onClick={next} disabled={!canContinue || pending}>
              {pending ? 'Saving…' : 'Save & continue'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
