'use client'

import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Wraps any input with its label, hint and error, wired together by id.
 *
 * Errors are linked with aria-describedby and aria-invalid rather than being
 * merely painted red — colour alone does not reach a screen reader, and it does
 * not reach anyone who cannot distinguish it either.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  children: (props: {
    id: string
    'aria-describedby': string | undefined
    'aria-invalid': boolean
  }) => React.ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[length:var(--text-small)] font-medium">
        {label}
        {/* Optional fields are marked; required ones are not. Most fields are
            required, so marking the exception is quieter than marking the rule. */}
        {optional && (
          <span className="ml-1 font-normal text-[var(--color-ink-muted)]">(optional)</span>
        )}
      </label>

      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })}

      {hint && !error && (
        <p id={hintId} className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[length:var(--text-small)] text-[var(--color-critical)]">
          {error}
        </p>
      )}
    </div>
  )
}

const control =
  'w-full bg-white border border-[var(--color-line)] rounded-[var(--radius-sm)] ' +
  'px-4 text-[length:var(--text-body)] transition-colors ' +
  'placeholder:text-[var(--color-ink-muted)] ' +
  'aria-[invalid=true]:border-[var(--color-critical)] ' +
  'disabled:bg-[var(--color-paper-soft)] disabled:cursor-not-allowed'

export function Input({
  className,
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(control, 'h-12', className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-32 py-3 leading-relaxed', className)} {...props} />
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'h-12 pr-10', className)} {...props}>
      {children}
    </select>
  )
}
