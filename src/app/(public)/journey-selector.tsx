'use client'

import { useRef, useSyncExternalStore } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ButtonLink, Heading, LiveRegion } from '@/components/ui'

const OPTIONS = [
  {
    label: "I'M CURIOUS",
    response: "You don't need an idea yet. Start by finding problems worth solving.",
    cta: 'Explore',
    href: '/onboarding?stage=exploring',
  },
  {
    label: 'I HAVE AN IDEA',
    response: "Good. Now let's find out if it's actually worth building.",
    cta: 'Validate',
    href: '/onboarding?stage=idea',
  },
  {
    label: "I'M BUILDING",
    response: 'The idea is no longer hypothetical. Now it needs users, feedback and momentum.',
    cta: 'Build',
    href: '/onboarding?stage=mvp',
  },
  {
    label: 'I HAVE A STARTUP',
    response: "You've crossed the first line. Now the question is how far it can go.",
    cta: 'Grow',
    href: '/onboarding?stage=scaling',
  },
  {
    label: 'I WANT TO HELP FOUNDERS',
    response: "Founders need people who've already done the hard part.",
    cta: 'Get involved',
    href: '/mentors',
  },
] as const

const journeyChoiceStore = {
  memoryChoice: null as number | null,
  listeners: [] as (() => void)[],
  subscribe(callback: () => void) {
    journeyChoiceStore.listeners.push(callback)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'knest_journey_choice') callback()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      journeyChoiceStore.listeners = journeyChoiceStore.listeners.filter((l) => l !== callback)
      window.removeEventListener('storage', onStorage)
    }
  },
  getSnapshot(): number | null {
    try {
      const saved = sessionStorage.getItem('knest_journey_choice')
      if (saved !== null) {
        const idx = Number(saved)
        if (Number.isInteger(idx) && idx >= 0 && idx < OPTIONS.length) {
          return idx
        }
      }
    } catch {
      // sessionStorage unavailable or restricted; fall back to memory
    }
    return journeyChoiceStore.memoryChoice !== null &&
      Number.isInteger(journeyChoiceStore.memoryChoice) &&
      journeyChoiceStore.memoryChoice >= 0 &&
      journeyChoiceStore.memoryChoice < OPTIONS.length
      ? journeyChoiceStore.memoryChoice
      : null
  },
  getServerSnapshot(): number | null {
    return null
  },
  set(i: number) {
    if (!Number.isInteger(i) || i < 0 || i >= OPTIONS.length) return
    journeyChoiceStore.memoryChoice = i
    try {
      sessionStorage.setItem('knest_journey_choice', String(i))
    } catch {}
    for (const listener of journeyChoiceStore.listeners) listener()
  },
}

/**
 * WHERE ARE YOU? — signature experience 02 (CONTENT_SPEC.md §1.5). Choosing
 * an option reveals a response written for that answer, not a bare label
 * redirect. For a stage-bearing option the destination is /onboarding?stage=…
 * — for a signed-out visitor that survives the sign-up detour intact (see
 * onboarding/page.tsx, login-form.tsx, signup-form.tsx) so the choice really
 * is remembered, per this section's own copy.
 */
export function JourneySelector({ signedIn }: { signedIn: boolean }) {
  const shouldReduceMotion = useReducedMotion()
  const selected = useSyncExternalStore(
    journeyChoiceStore.subscribe,
    journeyChoiceStore.getSnapshot,
    journeyChoiceStore.getServerSnapshot,
  )
  const option = selected !== null ? OPTIONS[selected] : null
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  function destinationFor(href: string): string {
    if (signedIn || !href.startsWith('/onboarding')) return href
    return `/signup?next=${encodeURIComponent(href)}`
  }

  function select(i: number) {
    journeyChoiceStore.set(i)
    const chosen = OPTIONS[i]
    if (!chosen) return
    // Fire-and-forget — the one client-triggered analytics call in the app
    // (src/app/api/analytics/track/route.ts), for a choice made entirely
    // client-side with no other server round-trip to piggyback on.
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'journey_selector_choice', props: { path: chosen.cta } }),
    }).catch(() => {})
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = (index + 1) % OPTIONS.length
      select(nextIndex)
      buttonRefs.current[nextIndex]?.focus()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (index - 1 + OPTIONS.length) % OPTIONS.length
      select(prevIndex)
      buttonRefs.current[prevIndex]?.focus()
    }
  }

  return (
    <div>
      <Heading as="h2" size="display">
        Where are you right now?
      </Heading>
      <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
        There&rsquo;s no wrong answer, and no stage that&rsquo;s too early.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr] items-stretch">
        <div role="radiogroup" aria-label="Where are you right now?" className="flex flex-col border-t border-[var(--color-line)]">
          {OPTIONS.map((opt, i) => {
            const isSelected = selected === i
            const tabIndex = selected === null ? (i === 0 ? 0 : -1) : (isSelected ? 0 : -1)
            return (
              <button
                key={opt.label}
                ref={(el) => { buttonRefs.current[i] = el }}
                type="button"
                role="radio"
                tabIndex={tabIndex}
                aria-checked={isSelected}
                onClick={() => select(i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className={`relative flex items-center justify-between border-b border-[var(--color-line)] py-4 sm:py-5 px-4 sm:px-6 text-left font-[family-name:var(--font-display)] text-base sm:text-lg font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] ${
                  isSelected
                    ? 'bg-[var(--color-signal-wash)] text-[var(--color-signal)] border-l-4 border-l-[var(--color-signal)]'
                    : 'bg-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-paper-soft)] hover:text-[var(--color-ink)]'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`font-mono text-sm transition-colors ${
                    isSelected
                      ? 'text-[var(--color-signal)] font-bold'
                      : 'text-[var(--color-ink-muted)] opacity-60'
                  }`}
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center">
          <AnimatePresence mode="wait">
            {option ? (
              <motion.div
                key={selected}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-6 sm:p-8 flex flex-col justify-between h-full min-h-[16rem]"
              >
                {/* The reveal replaces the "pick one" prompt with no page
                    reload — a screen reader user needs this announced the
                    same way a filter-count change already is elsewhere. */}
                <LiveRegion message={option.response} />
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--color-signal)] mb-3 block">
                    Next Step
                  </span>
                  <p className="font-[family-name:var(--font-accent)] text-xl sm:text-2xl italic text-[var(--color-ink)] leading-snug">
                    &ldquo;{option.response}&rdquo;
                  </p>
                </div>
                <div className="mt-8 pt-6 border-t border-[var(--color-line)]">
                  <ButtonLink
                    href={destinationFor(option.href)}
                    size="lg"
                    className="rounded-[var(--radius-sm)] bg-[var(--color-signal)] hover:bg-[var(--color-signal-deep)] text-white font-medium text-sm px-6 py-3 transition-colors inline-flex items-center gap-2"
                  >
                    <span>{option.cta}</span>
                    <span aria-hidden="true">→</span>
                  </ButtonLink>
                </div>
              </motion.div>
            ) : (
              <div
                className="w-full h-full min-h-[16rem] rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] p-8 flex flex-col items-center justify-center text-center bg-white"
              >
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--color-signal)] mb-2 block">
                  Select a Stage
                </span>
                <p className="font-[family-name:var(--font-display)] text-base sm:text-lg text-[var(--color-ink-muted)] font-medium">
                  Choose your current building phase on the left to view the recommended next step.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
