'use client'

import { motion, AnimatePresence } from 'framer-motion'
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
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[length:var(--text-small)] font-medium tracking-wide uppercase text-[var(--color-signal)]">
            Step {index} of {total}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-paper-soft)]">
          <motion.div
            initial={{ width: `${((index - 1) / total) * 100}%` }}
            animate={{ width: `${(index / total) * 100}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-signal)] to-red-500"
          />
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Heading as="h1" size="title" className="tracking-tight text-[var(--color-ink)]">
            {heading}
          </Heading>
          {subhead && <p className="mt-3 text-[length:var(--text-body)] text-[var(--color-ink-soft)] max-w-xl leading-relaxed">{subhead}</p>}

          <div className="mt-10">{children}</div>

          <div className="mt-14 flex items-center justify-between gap-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:pb-0 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:border-t max-md:border-[var(--color-line)] max-md:bg-[var(--color-paper)] max-md:px-6 max-md:py-4 z-20">
            {onBack ? (
              <button type="button" onClick={onBack} className="text-[length:var(--text-body)] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors">
                ← Back
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-6">
              {skip && (
                <button type="button" onClick={skip} className="text-[length:var(--text-small)] font-medium underline-offset-4 hover:underline text-[var(--color-ink-muted)]">
                  Skip for now
                </button>
              )}
              <Button onClick={onContinue} disabled={!canContinue || pending} size="lg" className="rounded-full px-8 shadow-sm">
                {pending ? 'Saving…' : continueLabel}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="h-24 md:hidden" aria-hidden />
    </div>
  )
}
