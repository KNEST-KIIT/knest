'use client'

import { useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * A selection grid with keyboard navigation, rich descriptions, and reduced-motion support.
 */

export type Option = {
  value: string
  label: string
  description?: string
  icon?: string
}

function BentoCard({
  selected,
  label,
  description,
  icon,
  onClick,
  onKeyDown,
  tabIndex,
  multi,
  buttonRef,
}: {
  selected: boolean
  label: string
  description?: string
  icon?: string
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
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
      className={`group relative flex w-full flex-col justify-between rounded-2xl border-2 p-5 text-left transition-all duration-200 cursor-pointer ${
        selected
          ? 'border-[var(--color-signal)] bg-white shadow-[0_4px_16px_rgba(122,31,43,0.08)] ring-1 ring-[var(--color-signal)]'
          : 'border-[var(--color-line)] bg-white/70 hover:border-[var(--color-signal)]/40 hover:bg-white hover:shadow-xs'
      } focus:outline-none focus:ring-2 focus:ring-[var(--color-signal)] focus:ring-offset-2`}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-paper-soft)] text-base">
              {icon}
            </span>
          )}
          <span className="font-semibold text-sm sm:text-base text-[var(--color-ink)] leading-snug">
            {label}
          </span>
        </div>
        <span
          aria-hidden
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 transition-all duration-200 ${
            multi ? 'rounded-md' : 'rounded-full'
          } ${
            selected
              ? 'border-[var(--color-signal)] bg-[var(--color-signal)]'
              : 'border-[var(--color-line-strong)] bg-white group-hover:border-[var(--color-signal)]/50'
          }`}
        >
          {selected && (
            <span className={`${multi ? 'size-2 bg-white' : 'size-2 rounded-full bg-white'}`} />
          )}
        </span>
      </div>

      {description && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-soft)]">
          {description}
        </p>
      )}
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
    <div role="radiogroup" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((opt, i) => {
        const isSelected = value === opt.value
        const tabIndex = selectedIndex === -1 ? (i === 0 ? 0 : -1) : isSelected ? 0 : -1
        return (
          <BentoCard
            key={opt.value}
            buttonRef={(el) => {
              buttonRefs.current[i] = el
            }}
            multi={false}
            selected={isSelected}
            tabIndex={tabIndex}
            label={opt.label}
            description={opt.description}
            icon={opt.icon}
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((opt) => (
        <BentoCard
          key={opt.value}
          multi
          selected={value.includes(opt.value)}
          label={opt.label}
          description={opt.description}
          icon={opt.icon}
          onClick={() => toggle(opt.value)}
        />
      ))}
    </div>
  )
}
