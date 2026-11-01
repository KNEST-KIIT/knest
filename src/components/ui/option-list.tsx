'use client'

import { useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * A selection grid with keyboard navigation and reduced-motion support.
 */

type Option = { value: string; label: string; description?: string }

function BentoCard({
  selected,
  label,
  description,
  onClick,
  onKeyDown,
  tabIndex,
  multi,
  buttonRef,
}: {
  selected: boolean
  label: string
  description?: string
  onClick: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  tabIndex?: number
  multi: boolean
  buttonRef?: React.Ref<HTMLButtonElement>
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      aria-label={label}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
      initial={false}
      animate={{
        backgroundColor: selected ? 'var(--color-paper-raised)' : 'rgba(255, 255, 255, 0.75)',
        borderColor: selected ? 'var(--color-signal)' : 'var(--color-line)',
      }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
      className={`group relative flex w-full flex-col items-start justify-between gap-3 rounded-[var(--radius-lg)] border-2 p-5 text-left text-[length:var(--text-body)] transition-all duration-200 ${
        selected
          ? 'shadow-[0_4px_16px_rgba(122,31,43,0.08)] ring-1 ring-[var(--color-signal)]/20'
          : 'shadow-sm hover:border-[var(--color-ink-soft)]/30 hover:bg-white hover:shadow-md'
      } focus:outline-none focus:ring-2 focus:ring-[var(--color-signal)] focus:ring-offset-2`}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-semibold tracking-tight text-[var(--color-ink)] group-hover:text-[var(--color-signal-deep)] transition-colors">
            {label}
          </span>
          {description && (
            <p className="text-[length:var(--text-small)] leading-relaxed text-[var(--color-ink-soft)]">
              {description}
            </p>
          )}
        </div>
        <span
          aria-hidden
          className={`flex size-5 shrink-0 items-center justify-center border-2 transition-all duration-200 mt-0.5 ${
            multi ? 'rounded-[var(--radius-sm)]' : 'rounded-full'
          } ${
            selected
              ? 'border-[var(--color-signal)] bg-[var(--color-signal)] shadow-sm'
              : 'border-[var(--color-line)] bg-white group-hover:border-[var(--color-ink-muted)]'
          }`}
        >
          {selected && (
            multi ? (
              <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6L5 8.5L9.5 3.5" />
              </svg>
            ) : (
              <span className="size-2 rounded-full bg-white" />
            )
          )}
        </span>
      </div>
    </motion.button>
  )
}

export function SingleSelect({
  options,
  value,
  onChange,
}: {
  options: Option[]
  value: string | null
  onChange: (value: string) => void
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = (index + 1) % options.length
      const nextOpt = options[nextIndex]
      if (nextOpt) {
        onChange(nextOpt.value)
        buttonRefs.current[nextIndex]?.focus()
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (index - 1 + options.length) % options.length
      const prevOpt = options[prevIndex]
      if (prevOpt) {
        onChange(prevOpt.value)
        buttonRefs.current[prevIndex]?.focus()
      }
    }
  }

  const selectedIndex = options.findIndex((opt) => opt.value === value)

  return (
    <div role="radiogroup" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((opt, i) => {
        const isSelected = value === opt.value
        const tabIndex = selectedIndex === -1 ? (i === 0 ? 0 : -1) : (isSelected ? 0 : -1)
        return (
          <BentoCard
            key={opt.value}
            buttonRef={(el) => { buttonRefs.current[i] = el }}
            multi={false}
            selected={isSelected}
            tabIndex={tabIndex}
            label={opt.label}
            description={opt.description}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          />
        )
      })}
    </div>
  )
}

export function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: Option[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((opt) => (
        <BentoCard
          key={opt.value}
          multi
          selected={value.includes(opt.value)}
          label={opt.label}
          description={opt.description}
          onClick={() => toggle(opt.value)}
        />
      ))}
    </div>
  )
}
