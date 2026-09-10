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
          'w-full bg-white/80 backdrop-blur-md border border-[var(--color-line)]/70 rounded-lg',
          'h-10 px-3.5 pr-14 text-sm text-[var(--color-ink)] transition-all duration-200 ease-out shadow-[0_1px_2px_rgba(0,0,0,0.03)]',
          'hover:border-[var(--color-archive)]/60 hover:bg-white',
          'focus:border-[var(--color-signal)] focus:ring-2 focus:ring-[var(--color-signal)]/15 focus:outline-none focus:bg-white',
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
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] hover:text-[var(--color-signal)] transition-colors"
      >
        <span className="sr-only">{visible ? 'Hide password' : 'Show password'}</span>
        <span aria-hidden>{visible ? 'Hide' : 'Show'}</span>
      </button>
    </div>
  )
}
