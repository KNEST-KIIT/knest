'use client'

import { formRequest } from '@/lib/form-request'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { EXPERTISE_OPTIONS, SECTOR_OPTIONS } from '@/payload/fields/taxonomy'
import { Field, Heading, Input, MultiSelect, SingleSelect, Textarea } from '@/components/ui'
import type { JourneyStage, PlatformRole } from '@/server/auth/roles'
import { completionDestination } from '@/server/onboarding/destination'
import { recommend } from '@/server/onboarding/recommend'
import { GOALS, JOURNEY_STAGES, MENTOR_AVAILABILITY, PLATFORM_ROLES } from '@/server/onboarding/validation'
import { StepShell } from './step-shell'

const ROLE_LABELS: Record<(typeof PLATFORM_ROLES)[number], string> = {
  student: 'Student',
  founder: 'Founder',
  mentor: 'Mentor',
  investor: 'Investor',
  alumni: 'Alumni',
  partner: 'Partner',
  other: 'Something else',
}

const GOAL_LABELS: Record<(typeof GOALS)[number], string> = {
  build_startup: 'Build a startup',
  explore: 'Explore entrepreneurship',
  join_program: 'Join a program',
  find_mentors: 'Find mentors',
  meet_cofounders: 'Meet co-founders',
  learn: 'Learn something new',
  support_founders: 'Support founders',
  partner: 'Partner with KNEST',
}

const STAGE_LABELS: Record<(typeof JOURNEY_STAGES)[number], string> = {
  exploring: 'Just exploring',
  idea: 'I have an idea',
  validation: 'Validating it',
  mvp: 'Building an MVP',
  early_revenue: 'Early revenue',
  scaling: 'Scaling',
  established: 'Established company',
}

const AVAILABILITY_LABELS: Record<(typeof MENTOR_AVAILABILITY)[number], string> = {
  open: 'Open to requests',
  limited: 'Limited availability',
  unavailable: 'Not currently available',
}

type Answers = {
  platformRole: PlatformRole | null
  goals: string[]
  journeyStage: JourneyStage | null
  interests: string[]
  name: string
  school: string
  linkedinUrl: string
  bio: string
  organization: string
  expertiseAreas: string[]
  mentorAvailability: string | null
}

type Props = {
  initial: Answers
  stagePrefill: JourneyStage | null
  /** Validated same-origin path the person was heading to; null if none. */
  next: string | null
  initialStep?: string
}

async function postStep(
  step: string,
  data?: unknown,
): Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }> {
  try {
    const res = await formRequest('/api/onboarding/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, data }),
    })

    // A 401 means the session expired mid-flow. Sending them to log back in
    // (with ?next= so they land back on /onboarding) is the honest response —
    // a generic "something went wrong" would hide that their answers past this
    // point were never saved.
    if (res.status === 401) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
      return { ok: false, error: 'Your session expired. Redirecting to log in…' }
    }

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        error: body.error ?? 'Something went wrong. Try again.',
        fieldErrors: body.fieldErrors,
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' }
  }
}

/**
 * Six adaptive steps, per CONTENT_SPEC.md §4 and USER_JOURNEYS.md Journey 4.
 * Mentors, investors and partners skip the journey-stage step (they have no
 * founder stage to report); mentors additionally get a different step 5.
 * The step list is recomputed from the current role on every render, so
 * changing the answer to step 1 immediately reshapes what follows.
 */
export function OnboardingFlow({ initial, stagePrefill, next, initialStep }: Props) {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [answers, setAnswers] = useState<Answers>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ linkedinUrl?: string; name?: string }>({})
  const [skippedStagePrefillNotice, setSkippedStagePrefillNotice] = useState(Boolean(stagePrefill))
  const linkedinRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pending) {
      if (fieldErrors.name) {
        nameRef.current?.focus()
      } else if (fieldErrors.linkedinUrl) {
        linkedinRef.current?.focus()
      }
    }
  }, [fieldErrors, pending])

  const isDirty = useMemo(() => {
    return JSON.stringify(answers) !== JSON.stringify(initial)
  }, [answers, initial])

  useEffect(() => {
    if (!isDirty || pending) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty, pending])

  const isPeopleRole = answers.platformRole === 'mentor' || answers.platformRole === 'investor' || answers.platformRole === 'partner'
  const isMentor = answers.platformRole === 'mentor'

  const steps = useMemo(() => {
    const list: string[] = ['role', 'goals']
    if (!isPeopleRole) list.push('stage')
    list.push('interests')
    list.push(isMentor ? 'mentor-profile' : 'profile')
    list.push('recommendation')
    return list
  }, [isPeopleRole, isMentor])

  const [index, setIndex] = useState(() => Math.max(0, steps.indexOf(initialStep ?? 'role')))

  function goTo(nextIndex: number) {
    const step = steps[nextIndex]
    if (!step) return
    setIndex(nextIndex)
    const url = new URL(window.location.href)
    url.searchParams.set('step', step)
    window.history.replaceState(null, '', url.pathname + url.search)
  }

  const total = steps.length
  const current = steps[index]

  function update<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  async function advance(step: string, data?: unknown) {
    setPending(true)
    setError(null)
    setFieldErrors({})
    const result = await postStep(step, data)
    setPending(false)
    if (!result.ok) {
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setFieldErrors(result.fieldErrors)
        setError(null)
      } else {
        setError(result.error ?? 'Something went wrong. Try again.')
        setFieldErrors({})
      }
      return
    }
    if (index === steps.length - 1) return
    goTo(index + 1)
  }

  function back() {
    setError(null)
    setFieldErrors({})
    goTo(Math.max(0, index - 1))
  }

  if (current === 'role') {
    return (
      <StepShell
        index={index + 1}
        total={total}
        heading="Who are you?"
        subhead="This changes what KNEST shows you. You can change it later."
        onContinue={() => advance('role', { platformRole: answers.platformRole })}
        canContinue={Boolean(answers.platformRole)}
        pending={pending}
      >
        <SingleSelect
          options={PLATFORM_ROLES.map((v) => ({ value: v, label: ROLE_LABELS[v] }))}
          value={answers.platformRole}
          onChange={(v) => update('platformRole', v as PlatformRole)}
        />
        {error && <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}
      </StepShell>
    )
  }

  if (current === 'goals') {
    return (
      <StepShell
        index={index + 1}
        total={total}
        heading="What brings you here?"
        subhead="Pick as many as apply."
        onBack={back}
        onContinue={() => advance('goals', { goals: answers.goals })}
        canContinue={answers.goals.length > 0}
        pending={pending}
      >
        <MultiSelect
          options={GOALS.map((v) => ({ value: v, label: GOAL_LABELS[v] }))}
          value={answers.goals}
          onChange={(v) => update('goals', v)}
        />
        {error && <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}
      </StepShell>
    )
  }

  if (current === 'stage') {
    return (
      <StepShell
        index={index + 1}
        total={total}
        heading="Where are you right now?"
        subhead="Be honest — there's no stage that's too early."
        onBack={back}
        onContinue={() => advance('stage', { journeyStage: answers.journeyStage })}
        canContinue={Boolean(answers.journeyStage)}
        pending={pending}
      >
        {skippedStagePrefillNotice && (
          <div className="mb-4 rounded-[var(--radius-sm)] bg-[var(--color-signal-wash)] px-4 py-3 text-[length:var(--text-small)]">
            You told us this on the way in — change it if that&rsquo;s not right.{' '}
            <button type="button" className="underline" onClick={() => setSkippedStagePrefillNotice(false)}>
              Dismiss
            </button>
          </div>
        )}
        <SingleSelect
          options={JOURNEY_STAGES.map((v) => ({ value: v, label: STAGE_LABELS[v] }))}
          value={answers.journeyStage}
          onChange={(v) => update('journeyStage', v as JourneyStage)}
        />
        {error && <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}
      </StepShell>
    )
  }

  if (current === 'interests') {
    return (
      <StepShell
        index={index + 1}
        total={total}
        heading="What are you interested in?"
        subhead="For recommending programs, events and people. Skip if you're not sure."
        onBack={back}
        onContinue={() => advance('interests', { interests: answers.interests })}
        skip={() => advance('interests', { interests: [] })}
        pending={pending}
      >
        <MultiSelect
          options={SECTOR_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={answers.interests}
          onChange={(v) => update('interests', v)}
        />
        {error && <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}
      </StepShell>
    )
  }

  if (current === 'mentor-profile') {
    const canContinue = Boolean(answers.name.trim()) && answers.expertiseAreas.length > 0 && Boolean(answers.mentorAvailability)
    return (
      <StepShell
        index={index + 1}
        total={total}
        heading="Tell us about you"
        subhead="Only your name, expertise and availability are required."
        onBack={back}
        onContinue={() =>
          advance('mentor-profile', {
            name: answers.name,
            organization: answers.organization,
            expertiseAreas: answers.expertiseAreas,
            mentorAvailability: answers.mentorAvailability,
            linkedinUrl: answers.linkedinUrl,
          })
        }
        canContinue={canContinue}
        pending={pending}
      >
        <div className="flex flex-col gap-6">
          <Field label="Name" error={fieldErrors.name}>
            {(p) => (
              <Input
                {...p}
                ref={nameRef}
                value={answers.name}
                onChange={(e) => {
                  update('name', e.target.value)
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }))
                }}
                required
              />
            )}
          </Field>
          <Field label="Organization" optional>
            {(p) => <Input {...p} value={answers.organization} onChange={(e) => update('organization', e.target.value)} />}
          </Field>
          <div>
            <p className="mb-2 text-[length:var(--text-small)] font-medium">What can founders come to you for?</p>
            <MultiSelect
              options={EXPERTISE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={answers.expertiseAreas}
              onChange={(v) => update('expertiseAreas', v)}
            />
          </div>
          <div>
            <p className="mb-2 text-[length:var(--text-small)] font-medium">Availability</p>
            <SingleSelect
              options={MENTOR_AVAILABILITY.map((v) => ({ value: v, label: AVAILABILITY_LABELS[v] }))}
              value={answers.mentorAvailability}
              onChange={(v) => update('mentorAvailability', v)}
            />
          </div>
          <Field label="LinkedIn" optional error={fieldErrors.linkedinUrl}>
            {(p) => (
              <Input
                {...p}
                ref={linkedinRef}
                type="url"
                value={answers.linkedinUrl}
                onChange={(e) => {
                  update('linkedinUrl', e.target.value)
                  if (fieldErrors.linkedinUrl) setFieldErrors((prev) => ({ ...prev, linkedinUrl: undefined }))
                }}
              />
            )}
          </Field>
        </div>
        {error && <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}
      </StepShell>
    )
  }

  if (current === 'profile') {
    return (
      <StepShell
        index={index + 1}
        total={total}
        heading="Tell us about you"
        subhead="Only your name is required. The rest helps people find you."
        onBack={back}
        onContinue={() =>
          advance('profile', {
            name: answers.name,
            school: answers.school,
            linkedinUrl: answers.linkedinUrl,
            bio: answers.bio,
          })
        }
        canContinue={Boolean(answers.name.trim())}
        pending={pending}
      >
        <div className="flex flex-col gap-6">
          <Field label="Name" error={fieldErrors.name}>
            {(p) => (
              <Input
                {...p}
                ref={nameRef}
                value={answers.name}
                onChange={(e) => {
                  update('name', e.target.value)
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }))
                }}
                required
              />
            )}
          </Field>
          <Field label="School or department" optional>
            {(p) => <Input {...p} value={answers.school} onChange={(e) => update('school', e.target.value)} />}
          </Field>
          <Field label="LinkedIn" optional error={fieldErrors.linkedinUrl}>
            {(p) => (
              <Input
                {...p}
                ref={linkedinRef}
                type="url"
                value={answers.linkedinUrl}
                onChange={(e) => {
                  update('linkedinUrl', e.target.value)
                  if (fieldErrors.linkedinUrl) setFieldErrors((prev) => ({ ...prev, linkedinUrl: undefined }))
                }}
              />
            )}
          </Field>
          <Field label="A line about yourself" optional hint="What are you interested in building, or figuring out?">
            {(p) => <Textarea {...p} value={answers.bio} onChange={(e) => update('bio', e.target.value)} />}
          </Field>
        </div>
        {error && <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">{error}</p>}
      </StepShell>
    )
  }

  // current === 'recommendation'
  const result = recommend(answers.platformRole ?? 'student', answers.journeyStage)

  return (
    <div className="relative">
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
        className="mx-auto max-w-2xl text-center"
      >
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-signal-wash)] text-[var(--color-signal)]">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <Heading as="h1" size="display" className="mb-3 text-[var(--color-ink)]">
          Your KNEST Path is Ready
        </Heading>
        <p className="mb-8 text-[length:var(--text-body)] text-[var(--color-ink-soft)]">
          Based on your profile, here is where you should begin.
        </p>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-white p-6 sm:p-10 text-left">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] pb-4">
            <span className="text-[length:var(--text-small)] font-semibold uppercase tracking-wider text-[var(--color-signal)]">
              Recommended Path
            </span>
            <span className="text-[length:var(--text-small)] font-medium text-[var(--color-ink-muted)] uppercase tracking-wider">
              {result.path}
            </span>
          </div>

          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl sm:text-3xl leading-snug text-[var(--color-ink)] font-bold">
            {result.headline || result.body}
          </h2>

          <p className="mb-8 text-[length:var(--text-body)] leading-relaxed text-[var(--color-ink-soft)]">
            {result.reason}
          </p>

          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              setError(null)
              const done = await postStep('complete')
              if (!done.ok) {
                // Never navigate on failure: /dashboard would bounce back to step 1
                // with no explanation (the old behaviour, KN-14).
                setPending(false)
                setError(done.error ?? 'We could not finish setting up your account. Try again.')
                return
              }
              router.push(completionDestination(next, result.path, answers.journeyStage))
              router.refresh()
            }}
            className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--color-ink-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-signal)] disabled:opacity-50"
          >
            {pending ? 'Finishing setup…' : next?.startsWith('/apply/') ? 'Continue to your application' : next === '/dashboard' ? 'Open your dashboard' : result.cta}
          </button>
          {error && (
            <p role="alert" className="mt-4 text-[length:var(--text-small)] text-[var(--color-critical)]">
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() => goTo(0)}
          className="mt-8 text-[length:var(--text-small)] font-medium text-[var(--color-ink-muted)] underline-offset-4 hover:text-[var(--color-ink)] hover:underline"
        >
          Not quite right? Re-configure your profile
        </button>
      </motion.div>
    </div>
  )
}
