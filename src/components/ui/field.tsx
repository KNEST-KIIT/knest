'use client'

import { useId } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { duration, ease } from '@/lib/motion'

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

      {/*
        The hint and the error occupy the same slot, and swapping them
        animates its height. Without this the whole form below the field
        jumps by a line the instant validation runs, which is both jarring
        and — because the thing that moved is the thing you were about to
        click — a real misclick risk.
      */}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={errorId}
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: duration.fast, ease: ease.entrance }}
            className="flex items-start gap-1.5 overflow-hidden text-[length:var(--text-small)] text-[var(--color-critical)]"
          >
            {/* The error is not communicated by colour alone. */}
            <svg aria-hidden viewBox="0 0 16 16" className="mt-[3px] size-3.5 shrink-0" fill="currentColor">
              <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2a.8.8 0 0 0-.8.85l.2 3.1a.6.6 0 0 0 1.2 0l.2-3.1A.8.8 0 0 0 8 5.7Zm0 5.1a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Z" />
            </svg>
            <span>{error}</span>
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            id={hintId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.fast, ease: ease.entrance }}
            className="overflow-hidden text-[length:var(--text-small)] text-[var(--color-ink-muted)]"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/**
 * The focus treatment is a border colour change plus a ring, not only the
 * global `:focus-visible` outline. On a bordered control an outline sitting
 * 2px outside the box reads as a halo around something that still looks
 * inactive; moving the border itself to the brand colour is what actually
 * says "you are typing here". The outline stays for keyboard users on top.
 */
const control =
  'w-full bg-white border border-[var(--color-line)] rounded-[var(--radius-sm)] ' +
  'px-4 text-[length:var(--text-body)] ' +
  'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] ' +
  'placeholder:text-[var(--color-ink-muted)] ' +
  'hover:border-[var(--color-ink-muted)] ' +
  'focus:border-[var(--color-signal)] focus:shadow-[0_0_0_3px_var(--color-signal-wash)] ' +
  'aria-[invalid=true]:border-[var(--color-critical)] ' +
  'aria-[invalid=true]:focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-critical)_14%,white)] ' +
  'disabled:bg-[var(--color-paper-soft)] disabled:cursor-not-allowed disabled:hover:border-[var(--color-line)]'

/**
 * A native <select> is kept — it is the right control on touch, where the OS
 * picker beats any custom listbox — but every browser draws its own arrow at
 * its own size. Suppressing it and painting one keeps the control looking
 * like the rest of the form.
 *
 * The arrow lives in globals.css rather than in an arbitrary Tailwind value.
 * An inline `bg-[url("data:image/svg+xml,…")]` needs quotes, `%23` and commas
 * to survive Tailwind's class parser; the first version of this compiled to
 * `background-image: none`, which suppressed the native arrow and drew
 * nothing in its place — a select with no affordance at all, and no error
 * anywhere to say so.
 */
const selectChevron = 'select-chevron'

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
    <select className={cn(control, selectChevron, 'h-12 pr-10', className)} {...props}>
      {children}
    </select>
  )
}
