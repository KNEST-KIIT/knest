'use client'

import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Heading } from '@/components/ui'
import { Button } from '@/components/ui/button'

/**
 * The shared frame every step renders inside: animated progress bar, heading, body,
 * and back/continue actions.
 */
export function StepShell({
  index,
  total,
  heading,
  subhead,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  canContinue = true,
  pending = false,
  skip,
  children,
}: {
  index: number
  total: number
  heading: string
  subhead?: string
  onBack?: () => void
  onContinue: () => void
  continueLabel?: string
  canContinue?: boolean
  pending?: boolean
  skip?: () => void
  children: React.ReactNode
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [index])

  const progressPct = ((index - 1) / total) * 100
  const activePct = (index / total) * 100

  return (
    <div className="relative">
      {/* Step Header & Animated Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--color-signal)]/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[var(--color-signal)]">
              Step {index} of {total}
            </span>
          </div>
          <span className="text-xs font-mono text-[var(--color-ink-muted)]">
            Autosaved
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Account setup"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index}
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-paper-soft)] border border-[var(--color-line)]"
        >
          <motion.div
            initial={{ width: `${progressPct}%` }}
            animate={{ width: `${activePct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-signal)] to-[var(--color-ink)]"
          />
        </div>
      </motion.div>

      {/* Main Step Content */}
      <motion.div
        key={index}
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}
      >
        <Heading
          ref={headingRef}
          tabIndex={-1}
          as="h1"
          size="title"
          className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)] outline-none"
        >
          {heading}
        </Heading>
        {subhead && (
          <p className="mt-2 text-sm sm:text-base text-[var(--color-ink-soft)] max-w-2xl leading-relaxed">
            {subhead}
          </p>
        )}

        <fieldset disabled={pending} className="mt-8 min-w-0" aria-label={heading}>
          {children}
        </fieldset>

        {/* Action Controls */}
        <div className="mt-12 flex items-center justify-between gap-4 border-t border-[var(--color-line)] pt-6">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              disabled={pending}
              className="text-sm font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-4">
            {skip && (
              <button
                type="button"
                onClick={skip}
                disabled={pending}
                className="text-xs font-medium text-[var(--color-ink-muted)] underline-offset-4 hover:underline hover:text-[var(--color-ink)] cursor-pointer"
              >
                Skip for now
              </button>
            )}
            <Button
              onClick={onContinue}
              disabled={!canContinue || pending}
              size="lg"
              className="min-w-32 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              {pending ? 'Saving…' : continueLabel}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
