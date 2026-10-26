'use client'

import { useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * A selection grid with keyboard navigation and reduced-motion support.
 */

type Option = { value: string; label: string }

function BentoCard({
  selected,
  label,
  onClick,
  onKeyDown,
  tabIndex,
  multi,
  buttonRef,
}: {
  selected: boolean
  label: string
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
      whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
      initial={false}
      animate={{
        backgroundColor: selected ? 'var(--color-signal-wash)' : 'var(--color-paper-soft)',
        borderColor: selected ? 'var(--color-signal)' : 'var(--color-line)',
      }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
      className="relative flex w-full flex-col items-start justify-center gap-2 rounded-[var(--radius-lg)] border-2 p-5 text-left text-[length:var(--text-body)] shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-signal)]"
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-medium text-[var(--color-ink)]">{label}</span>
        <span
          aria-hidden
          className={`flex size-5 shrink-0 items-center justify-center border-2 transition-colors duration-200 ${
            multi ? 'rounded-[var(--radius-sm)]' : 'rounded-full'
          } ${selected ? 'border-[var(--color-signal)] bg-[var(--color-signal)]' : 'border-[var(--color-line)] bg-white'}`}
        >
          {selected && <span className="size-2 rounded-full bg-white" />}
        </span>
      </div>
      {/* Optional: We can render descriptions here if we extend Option to have a 'description' */}
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
        <BentoCard key={opt.value} multi selected={value.includes(opt.value)} label={opt.label} onClick={() => toggle(opt.value)} />
      ))}
    </div>
  )
}
