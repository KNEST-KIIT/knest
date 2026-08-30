'use client'

import { useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { duration, ease } from '@/lib/motion'
import { Button } from './button'

/**
 * A modal dialog, for the one thing a modal is actually for: interrupting an
 * action that cannot be undone, so the person has to say yes on purpose.
 *
 * Built for the staff review screen, where moving an application to Accepted
 * or Not this time is irreversible and sends the applicant an email. Before
 * this, that was a single click with no confirmation step.
 *
 * Accessibility is the whole job here, so it is done by hand rather than
 * trusted to a library:
 *   - `aria-modal` + `role="dialog"`, labelled by the title and described by
 *     the body, so the dialog announces what it is and what it is asking.
 *   - Focus moves in on open and returns to whatever opened it on close.
 *     Returning focus is the half people skip, and it is the half that
 *     leaves keyboard users stranded at the top of the document.
 *   - Tab cycles inside. Escape closes. The backdrop closes.
 *   - The page behind cannot scroll while it is open.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  tone = 'default',
  pending = false,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  tone?: 'default' | 'danger'
  pending?: boolean
  children?: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusTo = useRef<HTMLElement | null>(null)
  const id = useId()
  const titleId = `${id}-title`
  const descId = description ? `${id}-desc` : undefined

  useEffect(() => {
    if (!open) return

    returnFocusTo.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the panel itself rather than its first control: reading the
    // question before landing on the button that answers it is the point of
    // stopping the user here.
    panelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusTo.current?.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
          <motion.div
            aria-hidden
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className="absolute inset-0 bg-[var(--color-ink)]/40 backdrop-blur-[2px]"
          />
          {/*
            The panel rises from the bottom on mobile and scales in on
            desktop, matching where it actually sits on each — a sheet that
            grows out of the middle of a phone screen has no origin.
          */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: duration.fast, ease: ease.exit } }}
            transition={{ duration: duration.base, ease: ease.entrance }}
            className={cn(
              'relative w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-line)]',
              'bg-white p-6 shadow-[var(--shadow-overlay)] focus:outline-none',
            )}
          >
            <h2 id={titleId} className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] uppercase">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-3 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                {description}
              </p>
            )}
            {children && <div className="mt-4">{children}</div>}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                {cancelLabel}
              </Button>
              {onConfirm && (
                <Button
                  type="button"
                  variant={tone === 'danger' ? 'danger' : 'primary'}
                  onClick={onConfirm}
                  pending={pending}
                  pendingLabel={`${confirmLabel}…`}
                >
                  {confirmLabel}
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
