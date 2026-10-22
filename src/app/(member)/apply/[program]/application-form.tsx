'use client'

import { formRequest } from '@/lib/form-request'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, Heading, Input, LiveRegion, MultiSelect, SingleSelect, Textarea } from '@/components/ui'
import type { ApplicationQuestion } from '@/server/applications/types'
import { TurnstileWidget } from '@/components/security/turnstile-widget'
import { applicationResumeIndex, formatApplicationAnswer as formatAnswer } from '@/lib/application-progress'
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits'

type Props = {
  applicationId: string
  programTitle: string
  questions: ApplicationQuestion[]
  initialAnswers: Record<string, unknown>
  initialDocuments: Record<string, string>
  turnstileSiteKey: string
}

async function postJSON(url: string, body: unknown) {
  const res = await formRequest(url, {
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
export function ApplicationForm({ applicationId, programTitle, questions, initialAnswers, initialDocuments, turnstileSiteKey }: Props) {
  const router = useRouter()
  const resumeIndex = applicationResumeIndex(questions, initialAnswers, initialDocuments)
  const [index, setIndex] = useState(Math.max(0, resumeIndex))
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers)
  const [savedAnswers, setSavedAnswers] = useState(initialAnswers)
  const [documentNames, setDocumentNames] = useState<Record<string, string>>(initialDocuments)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const captchaPending = Boolean(turnstileSiteKey) && !captchaToken
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [reviewing, setReviewing] = useState(resumeIndex === -1)
  const [returnToReview, setReturnToReview] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const total = questions.length
  const question = questions[index]
  function updateAnswer(questionId: string, value: unknown) {
    setError(null)
    setAnswers((previous) => ({ ...previous, [questionId]: value }))
  }
  const headingRef = useRef<HTMLHeadingElement>(null)
  const dirty = JSON.stringify(answers) !== JSON.stringify(savedAnswers)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [index, reviewing, submitted])
  useEffect(() => {
    if (!dirty || submitted) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, submitted])

  async function saveCurrent(): Promise<boolean> {
    if (!question) return true
    if (question.fieldType === 'file') { setError(null); return true } // documents save on selection, not on continue

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
    const savedValue = answers[question.id] ?? (question.fieldType === 'multiselect' ? [] : '')
    setAnswers((previous) => ({ ...previous, [question.id]: savedValue }))
    setSavedAnswers((previous) => ({ ...previous, [question.id]: savedValue }))
    return true
  }

  async function next() {
    const saved = await saveCurrent()
    if (!saved) return
    if (returnToReview || index === total - 1) { setReturnToReview(false); setReviewing(true) }
    else setIndex((i) => i + 1)
  }

  async function uploadFile(file: File) {
    if (!question) return
    if (file.size > MAX_UPLOAD_BYTES) { setError('That file is over 10 MB. Try compressing it.'); return }
    setPending(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('questionId', question.id)
    const res = await formRequest(`/api/applications/${applicationId}/documents`, { method: 'POST', body: form })
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
    const res = await formRequest(`/api/applications/${applicationId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken: captchaToken }),
    })
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
      // A Turnstile token is single-use: ask for a fresh one.
      setCaptchaToken(null)
      setCaptchaReset((n) => n + 1)
      return
    }
    setSubmitted(true)
  }

  async function saveAndLeave() {
    if (dirty && !(await saveCurrent())) return
    router.push('/dashboard/applications')
  }

  async function back() {
    if (dirty && !(await saveCurrent())) return
    setError(null)
    setIndex((previous) => previous - 1)
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
        <Heading ref={headingRef} tabIndex={-1} as="h1" size="title" className="outline-none">
          Your application is in.
        </Heading>
        <p className="mt-4 text-[var(--color-ink-soft)]">
          We&rsquo;ve got it. Here&rsquo;s what happens next: our team reads every application, and
          you&rsquo;ll hear from us. You can track the status any time from your dashboard. A confirmation is
          on its way to your inbox. Your answers and updates are kept together in your application.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button onClick={() => router.push(`/dashboard/applications/${applicationId}`)}>Track your application</Button>
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
        <Heading ref={headingRef} tabIndex={-1} as="h1" size="title" className="outline-none">
          Have a last look.
        </Heading>
        <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          Your draft is saved. Check each answer before sending it to the team. You won&rsquo;t be able to edit after submitting.
        </p>
        {total === 0 && <p className="mt-4">This program has no additional questions. Submitting sends your application to the team using your account details.</p>}

        <div className="mt-8 flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[length:var(--text-small)] font-medium text-[var(--color-ink-muted)]">{q.label}</p>
                <p className="mt-1 break-words">{q.fieldType === 'file' && documentNames[q.id] ? <a className="text-[var(--color-signal)] underline" href={`/api/applications/${applicationId}/documents/${q.id}`}>{documentNames[q.id]} — download to check</a> : q.fieldType === 'file' ? 'Not provided' : formatAnswer(answers[q.id], q.options)}</p>
              </div>
              <button
                type="button"
                disabled={pending}
                aria-label={`Edit ${q.label}`}
                onClick={() => {
                  setReviewing(false)
                  setReturnToReview(true)
                  setError(null)
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
        {error && <button type="button" disabled={pending} onClick={() => router.push(`/dashboard/applications/${applicationId}`)} className="mt-3 text-sm underline">Check current application status</button>}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          {total > 0 && <button type="button" disabled={pending} onClick={() => { setReviewing(false); setError(null) }} className="text-[length:var(--text-small)] font-medium">
            ← Back
          </button>}
          <Button onClick={submit} disabled={pending || captchaPending}>
            {pending ? 'Submitting…' : 'Submit application'}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={saveAndLeave}>Save and exit</Button>
        </div>
        <div className="mt-4">
          <TurnstileWidget siteKey={turnstileSiteKey} action="application-submit" onToken={setCaptchaToken} resetSignal={captchaReset} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            Apply to {programTitle} — Section {index + 1} of {total}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:max-w-[45%] sm:justify-end">
          <p role="status" className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">{dirty ? 'Unsaved changes' : lastSaved || Object.keys(savedAnswers).length || Object.keys(documentNames).length ? 'Draft saved' : 'Save each answer to keep your progress'}</p>
          <button type="button" disabled={pending} onClick={saveAndLeave} className="text-sm font-semibold text-[var(--color-signal)] underline">Save and exit</button>
        </div>
      </div>
      {/* Announced separately from the visible indicator above: the visible
          text alone doesn't reliably reach a screen reader user whose focus
          is still in the field they just filled in. */}
      <LiveRegion message={dirty ? 'Unsaved changes.' : lastSaved ? 'Answer saved.' : ''} />
      <div role="progressbar" aria-label="Application questions" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index + 1} className="h-1 w-full rounded-full bg-[var(--color-paper-soft)]">
        <div
          className="h-1 rounded-full bg-[var(--color-signal)] transition-[width] duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {question && (
        <div className="mt-8">
          <Heading ref={headingRef} tabIndex={-1} as="h1" size="title" className="outline-none">
            {question.label}
          </Heading>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{question.required === false ? 'Optional — you can leave this blank.' : 'Required'}</p>
          {question.helpText && <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{question.helpText}</p>}

          <fieldset disabled={pending} className="mt-6 min-w-0" aria-label={question.label}>
            {(question.fieldType === 'text' || question.fieldType === 'url') && (
              <Field label="Your answer" optional={question.required === false} hint={question.maxLength ? `${String(answers[question.id] ?? '').length} of ${question.maxLength} characters` : undefined}>
                {(p) => (
                  <Input
                    {...p}
                    type={question.fieldType === 'url' ? 'url' : 'text'}
                    value={(answers[question.id] as string) ?? ''}
                    maxLength={question.maxLength ?? undefined}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                  />
                )}
              </Field>
            )}

            {question.fieldType === 'textarea' && (
              <Field label="Your answer" optional={question.required === false} hint={question.maxLength ? `${String(answers[question.id] ?? '').length} of ${question.maxLength} characters` : undefined}>
                {(p) => (
                  <Textarea
                    {...p}
                    value={(answers[question.id] as string) ?? ''}
                    maxLength={question.maxLength ?? undefined}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                  />
                )}
              </Field>
            )}

            {question.fieldType === 'select' && (
              <SingleSelect
                options={(question.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                value={(answers[question.id] as string) ?? null}
                onChange={(v) => updateAnswer(question.id, v)}
              />
            )}

            {question.fieldType === 'multiselect' && (
              <MultiSelect
                options={(question.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                value={(answers[question.id] as string[]) ?? []}
                onChange={(v) => updateAnswer(question.id, v)}
              />
            )}

            {question.fieldType === 'file' && (
              <div>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-line)] px-6 py-10 text-center hover:border-[var(--color-signal)]">
                  <span className="text-[length:var(--text-small)]">
                    {pending ? 'Uploading…' : documentNames[question.id] ? `${documentNames[question.id]} — choose a replacement` : 'Choose a file'}
                  </span>
                  <span className="text-[length:var(--text-micro)] text-[var(--color-ink-muted)]">
                    PDF, DOC or PPT. Up to 10 MB.
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                    className="sr-only"
                    aria-label={question.label}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadFile(file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            )}
          </fieldset>

          {error && <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}

          <div className="mt-10 flex items-center justify-between">
            {index > 0 ? (
              <button type="button" disabled={pending} onClick={back} className="text-[length:var(--text-small)] font-medium">
                ← Back
              </button>
            ) : (
              <span />
            )}
            <Button onClick={next} disabled={!canContinue || pending}>
              {pending ? 'Saving…' : returnToReview ? 'Save and return to review' : 'Save & continue'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
