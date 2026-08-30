'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Heading, LiveRegion } from '@/components/ui'
import { cn } from '@/lib/cn'
import { duration, ease, spring } from '@/lib/motion'

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

/**
 * WHERE ARE YOU? — signature experience 02 (CONTENT_SPEC.md §1.5). Choosing
 * an option reveals a response written for that answer, not a bare label
 * redirect. For a stage-bearing option the destination is /onboarding?stage=…
 * — for a signed-out visitor that survives the sign-up detour intact (see
 * onboarding/page.tsx, login-form.tsx, signup-form.tsx) so the choice really
 * is remembered, per this section's own copy.
 *
 * The keyboard behaviour is a fix, not a flourish. This was already marked up
 * as `role="radiogroup"` with five `role="radio"` children, which is a
 * promise: the ARIA pattern for a radio group is one tab stop, with arrow
 * keys moving between options. It was implemented as five separate tab stops
 * with no arrow handling, so a keyboard user got neither the native
 * behaviour nor the promised one. Now it is a roving tabindex with Arrow,
 * Home and End — and, as the pattern requires, moving the selection selects.
 */
export function JourneySelector({ signedIn }: { signedIn: boolean }) {
  const [selected, setSelected] = useState<number | null>(null)
  // Tracked separately from `selected` so the group has a tab stop before
  // anything has been chosen.
  const [focusIndex, setFocusIndex] = useState(0)
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])
  const option = selected !== null ? OPTIONS[selected] : null

  function destinationFor(href: string): string {
    if (signedIn || !href.startsWith('/onboarding')) return href
    return `/signup?next=${encodeURIComponent(href)}`
  }

  function select(i: number) {
    setSelected(i)
    setFocusIndex(i)
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

  function onKeyDown(event: React.KeyboardEvent) {
    const last = OPTIONS.length - 1
    let next: number | null = null
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = focusIndex === last ? 0 : focusIndex + 1
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = focusIndex === 0 ? last : focusIndex - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    select(next)
    buttonsRef.current[next]?.focus()
  }

  return (
    <div>
      <Heading as="h2" size="display">
        Where are you right now?
      </Heading>
      <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
        There&rsquo;s no wrong answer, and no stage that&rsquo;s too early.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div
          role="radiogroup"
          aria-label="Where are you right now?"
          onKeyDown={onKeyDown}
          className="flex flex-col gap-3"
        >
          {OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              ref={(el) => {
                buttonsRef.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected === i}
              tabIndex={focusIndex === i ? 0 : -1}
              onClick={() => select(i)}
              onFocus={() => setFocusIndex(i)}
              className={cn(
                'relative rounded-[var(--radius-lg)] border px-6 py-5 text-left',
                'font-[family-name:var(--font-display)] text-[length:var(--text-heading)] uppercase tracking-tight',
                'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
                selected === i
                  ? 'border-transparent text-[var(--color-signal-deep)]'
                  : 'border-[var(--color-line)] bg-white hover:border-[var(--color-ink)]',
              )}
            >
              {/*
                One wash that travels between options rather than five that
                each fade. The movement is the answer to "what did my key
                press just do" — it shows which way the selection went, which
                a colour swap in two places cannot.
              */}
              {selected === i && (
                <motion.span
                  layoutId="journey-selection"
                  aria-hidden
                  transition={spring.smooth}
                  className="absolute inset-0 rounded-[var(--radius-lg)] border border-[var(--color-signal)] bg-[var(--color-signal-wash)]"
                />
              )}
              <span className="relative">{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center">
          {/* The reveal replaces the "pick one" prompt with no page
              reload — a screen reader user needs this announced the
              same way a filter-count change already is elsewhere. */}
          <LiveRegion message={option?.response ?? ''} />
          <AnimatePresence mode="wait" initial={false}>
            {option ? (
              <motion.div
                key={option.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: duration.instant, ease: ease.exit } }}
                transition={{ duration: duration.base, ease: ease.entrance }}
                className="w-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-8"
              >
                <p className="text-[length:var(--text-heading)] text-[var(--color-ink)]">{option.response}</p>
                <Link
                  href={destinationFor(option.href)}
                  className={cn(
                    'group mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)]',
                    'bg-[var(--color-signal)] px-6 text-[length:var(--text-small)] font-medium text-white',
                    'transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-signal-deep)]',
                    'active:scale-[0.98]',
                  )}
                >
                  {option.cta}
                  {/* The arrow leans toward where the link goes on hover. */}
                  <span className="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              </motion.div>
            ) : (
              <motion.p
                key="prompt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: duration.instant } }}
                className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]"
              >
                Pick whichever feels true right now.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
