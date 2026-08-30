'use client'

import { AnimatePresence, motion } from 'motion/react'
import { duration, ease } from '@/lib/motion'

/**
 * The form-level error: the one that is about the submission as a whole
 * ("Email or password is incorrect"), not about a single field.
 *
 * It had been hand-written as a bare `<p role="alert">` in four auth forms
 * and two action buttons, appearing instantly and shoving the submit button
 * down the page at the exact moment the user was reaching for it. Here it
 * animates its own height open, so the layout settles instead of jumping,
 * and the alert semantics are in one place rather than remembered six times.
 */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {children ? (
        <motion.div
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: duration.fast, ease: ease.entrance }}
          className="overflow-hidden"
        >
          <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--color-critical)] bg-[color-mix(in_srgb,var(--color-critical)_6%,white)] px-3 py-2.5 text-[length:var(--text-small)] text-[var(--color-critical)]">
            <svg aria-hidden viewBox="0 0 16 16" className="mt-[3px] size-3.5 shrink-0" fill="currentColor">
              <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2a.8.8 0 0 0-.8.85l.2 3.1a.6.6 0 0 0 1.2 0l.2-3.1A.8.8 0 0 0 8 5.7Zm0 5.1a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Z" />
            </svg>
            <span>{children}</span>
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
