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

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr] items-stretch">
        <motion.div layout role="radiogroup" aria-label="Where are you right now?" className="flex flex-col border-t border-[var(--color-line)]">
          {OPTIONS.map((opt, i) => (
            <motion.button layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }}
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={selected === i}
              onClick={() => select(i)}
              className={`group flex items-center justify-between rounded-none border-b border-[var(--color-line)] border-l-4 py-3.5 sm:py-4 pr-5 pl-5 text-left font-[family-name:var(--font-display)] text-base sm:text-lg lg:text-xl font-bold uppercase tracking-wide transition-all duration-200 ${
                selected === i
                  ? 'border-l-[var(--color-signal)] bg-[var(--color-signal)]/8 text-[var(--color-signal)] shadow-sm'
                  : 'border-l-transparent bg-transparent hover:border-l-[var(--color-line)] hover:bg-black/[0.02] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
              }`}
            >
              <span>{opt.label}</span>
              <span
                className={`font-mono text-sm transition-all duration-200 ${
                  selected === i
                    ? 'text-[var(--color-signal)] translate-x-1 font-bold'
                    : 'text-[var(--color-ink-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1'
                }`}
              >
                →
              </span>
            </motion.button>
          ))}
        </motion.div>

        <div className="flex items-center">
          <AnimatePresence mode="wait">
          {option ? (
            <motion.div 
              key={selected}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full rounded-none border-2 border-[var(--color-line)] bg-white p-7 sm:p-9 relative overflow-hidden shadow-sm flex flex-col justify-between h-full min-h-[260px]"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--color-signal)]"></div>
              {/* The reveal replaces the "pick one" prompt with no page
                  reload — a screen reader user needs this announced the
                  same way a filter-count change already is elsewhere. */}
              <LiveRegion message={option.response} />
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-signal)] mb-3 block">
                  Next Tactical Step
                </span>
                <p className="font-[family-name:var(--font-accent)] text-lg sm:text-xl md:text-2xl italic text-[var(--color-ink)] leading-snug">
                  &ldquo;{option.response}&rdquo;
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[var(--color-line)]">
                <ButtonLink href={destinationFor(option.href)} size="lg" className="rounded-none px-8 py-3.5 font-bold uppercase tracking-widest text-xs sm:text-sm bg-[var(--color-signal)] hover:bg-[var(--color-signal-deep)] text-white shadow-md inline-flex items-center gap-2">
                  <span>{option.cta}</span>
                  <span>→</span>
                </ButtonLink>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full min-h-[260px] border-2 border-dashed border-[var(--color-line)] p-8 flex flex-col items-center justify-center text-center bg-white/40"
            >
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-signal)] mb-2">
                Self-Assessment
              </span>
              <p className="font-[family-name:var(--font-display)] text-base sm:text-lg text-[var(--color-ink-muted)] font-medium">
                Select your current building phase on the left to reveal your dedicated trajectory.
              </p>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
