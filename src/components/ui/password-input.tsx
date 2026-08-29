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
          'w-full bg-white border border-[var(--color-line)] rounded-[var(--radius-sm)]',
          'h-12 px-4 pr-14 text-[length:var(--text-body)] transition-colors',
          'placeholder:text-[var(--color-ink-muted)]',
          'aria-[invalid=true]:border-[var(--color-critical)]',
          'disabled:bg-[var(--color-paper-soft)] disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
      <button
        id={toggleId}
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[length:var(--text-small)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        <span className="sr-only">{visible ? 'Hide password' : 'Show password'}</span>
        <span aria-hidden>{visible ? 'Hide' : 'Show'}</span>
      </button>
    </div>
  )
}
