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
  'w-full bg-white/60 backdrop-blur-md border border-[var(--color-line)]/60 rounded-[var(--radius-md)] ' +
  'px-4 text-[length:var(--text-body)] transition-all duration-300 ease-out shadow-sm ' +
  'hover:border-[var(--color-archive)]/50 hover:bg-white hover:shadow-md ' +
  'focus:border-[var(--color-signal)] focus:ring-4 focus:ring-[var(--color-signal)]/10 focus:outline-none focus:bg-white ' +
  'placeholder:text-[var(--color-ink-muted)] ' +
  'aria-[invalid=true]:border-[var(--color-critical)] aria-[invalid=true]:ring-[var(--color-critical)]/20 ' +
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
    <div className={cn("relative group", className)}>
      <select 
        className={cn(control, 'appearance-none h-12 w-full pr-11 cursor-pointer')} 
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--color-ink-muted)] group-hover:text-[var(--color-signal)] transition-colors duration-300">
        <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}
