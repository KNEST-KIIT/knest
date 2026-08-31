'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

/**
 * WHERE ARE YOU? — signature experience 02 (CONTENT_SPEC.md §1.5). Choosing
 * an option reveals a response written for that answer, not a bare label
 * redirect. For a stage-bearing option the destination is /onboarding?stage=…
 * — for a signed-out visitor that survives the sign-up detour intact (see
 * onboarding/page.tsx, login-form.tsx, signup-form.tsx) so the choice really
 * is remembered, per this section's own copy.
 */
export function JourneySelector({ signedIn }: { signedIn: boolean }) {
  const [selected, setSelected] = useState<number | null>(null)
  const option = selected !== null ? OPTIONS[selected] : null

  function destinationFor(href: string): string {
    if (signedIn || !href.startsWith('/onboarding')) return href
    return `/signup?next=${encodeURIComponent(href)}`
  }

  function select(i: number) {
    setSelected(i)
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

  return (
    <div>
      <Heading as="h2" size="display">
        Where are you right now?
      </Heading>
      <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
        There&rsquo;s no wrong answer, and no stage that&rsquo;s too early.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <motion.div layout role="radiogroup" aria-label="Where are you right now?" className="flex flex-col gap-3">
          {OPTIONS.map((opt, i) => (
            <motion.button layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }}
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={selected === i}
              onClick={() => select(i)}
              className={`rounded-[var(--radius-lg)] border px-6 py-5 text-left font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-semibold uppercase tracking-[0.01em] shadow-[var(--shadow-raised)] transition-[border-color,background-color,color,box-shadow] duration-150 ${
                selected === i
                  ? 'border-[var(--color-signal)] bg-[var(--color-signal-wash)] text-[var(--color-signal-deep)] shadow-[var(--shadow-floating)]'
                  : 'border-[var(--color-line)] bg-white hover:border-[var(--color-signal)] hover:shadow-[var(--shadow-floating)]'
              }`}
            >
              {opt.label}
            </motion.button>
          ))}
        </motion.div>

        <div className="flex items-center">
          <AnimatePresence mode="wait">
          {option ? (
            <motion.div 
              key={selected}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-8 shadow-[var(--shadow-raised)]"
            >
              {/* The reveal replaces the "pick one" prompt with no page
                  reload — a screen reader user needs this announced the
                  same way a filter-count change already is elsewhere. */}
              <LiveRegion message={option.response} />
              <p className="font-[family-name:var(--font-accent)] text-[length:var(--text-heading)] italic text-[var(--color-ink)]">
                {option.response}
              </p>
              <ButtonLink href={destinationFor(option.href)} className="mt-6">
                {option.cta} →
              </ButtonLink>
            </motion.div>
          ) : (
            <motion.p 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
