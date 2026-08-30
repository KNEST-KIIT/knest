'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { duration, ease, spring } from '@/lib/motion'

/**
 * Transient confirmation for actions that would otherwise complete silently.
 *
 * Built because the app had no feedback mechanism at all: a staff member
 * could move an application to Accepted — which is irreversible and emails
 * the applicant — and the only response was the page quietly re-rendering.
 *
 * Deliberately not a general notification centre. A toast is for "the thing
 * you just did worked", it is never the only place information appears, and
 * nothing that matters is allowed to live only here — anything durable
 * belongs in the notifications table that already exists.
 */

export type ToastTone = 'success' | 'error' | 'info'

type Toast = {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

type ToastInput = Omit<Toast, 'id'>

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

/** How long a toast stays. Errors stay longer — they are more to read, and they matter more. */
const DISMISS_AFTER: Record<ToastTone, number> = {
  success: 4500,
  info: 5000,
  error: 8000,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++
      setToasts((current) => [...current, { ...input, id }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER[input.tone]),
      )
    },
    [dismiss],
  )

  const value = useMemo(() => toast, [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        One live region that exists from first render, rather than being
        created when the first toast fires — a region inserted at the same
        moment as its content is frequently not announced at all. Success
        and info are polite; errors are assertive, and carry role="alert" on
        the toast itself.
      */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className={cn(
          'pointer-events-none fixed z-[100] flex flex-col gap-2',
          // Above the home indicator on mobile, out of the way of the
          // primary action on desktop.
          'inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))]',
          'sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(24rem,calc(100vw-3rem))]',
        )}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

/**
 * @throws if used outside `ToastProvider` — a silent no-op here would mean an
 * action reports success to nobody, which is the exact failure this exists
 * to fix.
 */
export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>')
  return toast
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-[var(--color-signal)] bg-white',
  error: 'border-[var(--color-critical)] bg-white',
  info: 'border-[var(--color-line)] bg-white',
}

const TONE_ICON: Record<ToastTone, { path: string; className: string }> = {
  success: { path: 'M13.5 4.5 6.5 11.5 2.5 7.5', className: 'text-[var(--color-signal)]' },
  error: { path: 'M12 4 4 12M4 4l8 8', className: 'text-[var(--color-critical)]' },
  info: { path: 'M8 7.5v4M8 4.6v.1', className: 'text-[var(--color-ink-muted)]' },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icon = TONE_ICON[toast.tone]
  return (
    <motion.div
      layout
      role={toast.tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: duration.fast, ease: ease.exit } }}
      transition={spring.smooth}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-[var(--radius-md)] border p-4',
        'shadow-[var(--shadow-floating)]',
        TONE_STYLES[toast.tone],
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className={cn('mt-0.5 size-4 shrink-0', icon.className)}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon.path} />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--text-small)] font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        // -m-2 p-2 keeps the hit area at 40px without the icon looking oversized.
        className="-m-2 shrink-0 rounded-[var(--radius-sm)] p-2 text-[var(--color-ink-muted)] transition-colors duration-[var(--duration-instant)] hover:text-[var(--color-ink)]"
      >
        <span className="sr-only">Dismiss</span>
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </motion.div>
  )
}
