'use client'

import { Heading } from '@/components/ui'
import { Button } from '@/components/ui/button'

/**
 * The shared frame every step renders inside: progress bar, heading, body,
 * and back/continue actions. Buttons sit fixed to the bottom on mobile inside
 * the safe area and inline on desktop (UX_WIREFRAMES.md §6).
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
    <div>
      <div className="mb-8">
        <p className="mb-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          Step {index} of {total}
        </p>
        <div className="h-1 w-full rounded-full bg-[var(--color-paper-soft)]">
          <div
            className="h-1 rounded-full bg-[var(--color-signal)] transition-[width] duration-300"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      </div>

      <Heading as="h1" size="title">
        {heading}
      </Heading>
      {subhead && <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{subhead}</p>}

      <div className="mt-6">{children}</div>

      <div className="mt-10 flex items-center justify-between gap-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:pb-0 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:border-t max-md:border-[var(--color-line)] max-md:bg-[var(--color-paper)] max-md:px-6 max-md:py-4">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-[length:var(--text-small)] font-medium">
            ← Back
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4">
          {skip && (
            <button type="button" onClick={skip} className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
              Skip for now
            </button>
          )}
          <Button onClick={onContinue} disabled={!canContinue || pending}>
            {pending ? 'Saving…' : continueLabel}
          </Button>
        </div>
      </div>
      {/* Reserves space so the fixed mobile bar never covers content above it. */}
      <div className="h-24 md:hidden" aria-hidden />
    </div>
  )
}
