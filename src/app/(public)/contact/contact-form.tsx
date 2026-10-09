'use client'

import { useState } from 'react'
import { Field, Input, Textarea } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { TurnstileWidget } from '@/components/security/turnstile-widget'
import { ENQUIRY_TOPICS, MAX_ENQUIRY_MESSAGE } from '@/server/enquiries/validation'

export function ContactForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const captchaPending = Boolean(turnstileSiteKey) && !captchaToken

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const res = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        topic: form.get('topic'),
        message: form.get('message'),
        website: form.get('website'),
        turnstileToken: captchaToken,
      }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    if (!res?.ok) {
      setError(data?.error ?? 'We couldn’t send that. Check your connection and try again.')
      setPending(false)
      setCaptchaToken(null)
      setCaptchaReset((n) => n + 1)
      return
    }
    setSent(true)
    setPending(false)
  }

  if (sent) {
    return (
      <div role="status" className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-8">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">Thanks, we’ve got your message.</h2>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          The KNEST team will read it and reply by email. If it is about your account or an application, mention the email address you signed up with.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="Your name">{(props) => <Input {...props} name="name" autoComplete="name" required minLength={2} maxLength={100} />}</Field>
      <Field label="Email address">
        {(props) => <Input {...props} name="email" type="email" autoComplete="email" required maxLength={254} />}
      </Field>
      <Field label="What is this about?">
        {(props) => (
          <select
            {...props}
            name="topic"
            required
            defaultValue="general"
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-white px-3 text-base"
          >
            {ENQUIRY_TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Your message" hint={`Up to ${MAX_ENQUIRY_MESSAGE} characters.`}>
        {(props) => <Textarea {...props} name="message" required minLength={10} maxLength={MAX_ENQUIRY_MESSAGE} rows={6} />}
      </Field>

      {/* Honeypot: invisible to people and to screen readers, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-critical)]">
          {error}
        </p>
      )}

      <TurnstileWidget siteKey={turnstileSiteKey} action="contact" onToken={setCaptchaToken} resetSignal={captchaReset} />

      <Button type="submit" size="lg" disabled={pending || captchaPending} aria-busy={pending}>
        {pending ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  )
}
