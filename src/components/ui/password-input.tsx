'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * A password field with a labelled show/hide toggle.
 *
 * The toggle's accessible name changes with its state ("Show password" /
 * "Hide password") rather than relying on an icon alone, and the input's own
 * label and error wiring is left to the caller via the passed-through id and
 * aria attributes — this only owns the reveal behaviour.
 */
export function PasswordInput({
  id,
  className,
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; ref?: React.Ref<HTMLInputElement> }) {
  const [visible, setVisible] = useState(false)
  const toggleId = useId()

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        type={visible ? 'text' : 'password'}
        className={cn(
          'w-full bg-white/60 backdrop-blur-md border border-[var(--color-line)]/60 rounded-[var(--radius-md)]',
          'h-12 px-4 pr-16 text-[length:var(--text-body)] transition-all duration-300 ease-out shadow-sm',
          'hover:border-[var(--color-archive)]/50 hover:bg-white hover:shadow-md',
          'focus:border-[var(--color-signal)] focus:ring-4 focus:ring-[var(--color-signal)]/10 focus:outline-none focus:bg-white',
          'placeholder:text-[var(--color-ink-muted)]',
          'aria-[invalid=true]:border-[var(--color-critical)] aria-[invalid=true]:ring-[var(--color-critical)]/20',
          'disabled:bg-[var(--color-paper-soft)] disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
      <button
        id={toggleId}
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] hover:text-[var(--color-signal)] transition-colors"
      >
        <span className="sr-only">{visible ? 'Hide password' : 'Show password'}</span>
        <span aria-hidden>{visible ? 'Hide' : 'Show'}</span>
      </button>
    </div>
  )
}
