'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EXPERTISE_OPTIONS, SECTOR_OPTIONS } from '@/payload/fields/taxonomy'
import { Field, Heading, Input, MultiSelect, SingleSelect, Textarea } from '@/components/ui'
import type { JourneyStage, PlatformRole } from '@/server/auth/roles'
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
}

async function postStep(step: string, data?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/onboarding/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step, data }),
  })

  // A 401 means the session expired mid-flow. Sending them to log back in
  // (with ?next= so they land back on /onboarding) is the honest response —
  // a generic "something went wrong" would hide that their answers past this
  // point were never saved.
  if (res.status === 401) {
    window.location.href = '/login?next=%2Fonboarding'
    return { ok: false, error: 'Your session expired. Redirecting to log in…' }
  }

  const body = await res.json().catch(() => ({}))
  return res.ok ? { ok: true } : { ok: false, error: body.error }
}

/**
 * Six adaptive steps, per CONTENT_SPEC.md §4 and USER_JOURNEYS.md Journey 4.
 * Mentors, investors and partners skip the journey-stage step (they have no
 * founder stage to report); mentors additionally get a different step 5.
 * The step list is recomputed from the current role on every render, so
 * changing the answer to step 1 immediately reshapes what follows.
 */
export function OnboardingFlow({ initial, stagePrefill }: Props) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skippedStagePrefillNotice, setSkippedStagePrefillNotice] = useState(Boolean(stagePrefill))

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

  const total = steps.length
  const current = steps[index]

  function update<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  async function advance(step: string, data?: unknown) {
    setPending(true)
    setError(null)
    const result = await postStep(step, data)
    setPending(false)
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong. Try again.')
      return
    }
    if (index === steps.length - 1) return
    setIndex((i) => i + 1)
  }

  function back() {
    setError(null)
    setIndex((i) => Math.max(0, i - 1))
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
          <Field label="Name">
            {(p) => <Input {...p} value={answers.name} onChange={(e) => update('name', e.target.value)} required />}
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
          <Field label="LinkedIn" optional>
            {(p) => <Input {...p} type="url" value={answers.linkedinUrl} onChange={(e) => update('linkedinUrl', e.target.value)} />}
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
            skills: [],
          })
        }
        canContinue={Boolean(answers.name.trim())}
        pending={pending}
      >
        <div className="flex flex-col gap-6">
          <Field label="Name">
            {(p) => <Input {...p} value={answers.name} onChange={(e) => update('name', e.target.value)} required />}
          </Field>
          <Field label="School or department" optional>
            {(p) => <Input {...p} value={answers.school} onChange={(e) => update('school', e.target.value)} />}
          </Field>
          <Field label="LinkedIn" optional>
            {(p) => <Input {...p} type="url" value={answers.linkedinUrl} onChange={(e) => update('linkedinUrl', e.target.value)} />}
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
    <div>
      <p className="mb-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        Step {total} of {total}
      </p>
      <div className="mb-8 h-1 w-full rounded-full bg-[var(--color-signal)]" />

      <Heading as="h1" size="title">
        Your KNEST path
      </Heading>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6">
        <p className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] uppercase text-[var(--color-signal)]">
          {result.path}
        </p>
        <p className="mt-2 text-[length:var(--text-body)]">{result.body}</p>
        <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
          <strong>Why this: </strong>
          {result.reason}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            await postStep('complete')
            router.push('/dashboard')
            router.refresh()
          }}
          className="mt-6 inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-signal)] px-6 font-medium text-white hover:bg-[var(--color-signal-deep)] disabled:opacity-50"
        >
          {pending ? 'Finishing…' : result.cta}
        </button>
      </div>

      <button type="button" onClick={() => setIndex(0)} className="mt-6 text-[length:var(--text-small)] text-[var(--color-signal)]">
        Not quite right? Change your answers.
      </button>
    </div>
  )
}
