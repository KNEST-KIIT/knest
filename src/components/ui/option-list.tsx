'use client'

import { motion } from 'framer-motion'

/**
 * A beautiful, animated Bento-style selection grid. 
 * Replaces the basic radio/checkbox rows with luxury interactive cards.
 */

type Option = { value: string; label: string }

function BentoCard({
  selected,
  label,
  onClick,
  multi,
}: {
  selected: boolean
  label: string
  onClick: () => void
  multi: boolean
}) {
  return (
    <motion.button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={false}
      animate={{
        backgroundColor: selected ? 'var(--color-signal-wash)' : 'var(--color-paper-soft)',
        borderColor: selected ? 'var(--color-signal)' : 'var(--color-line)',
      }}
      transition={{ duration: 0.2 }}
      className="relative flex w-full flex-col items-start justify-center gap-2 rounded-[var(--radius-lg)] border-2 p-5 text-left text-[length:var(--text-body)] shadow-sm hover:shadow-md"
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
  return (
    <div role="radiogroup" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((opt) => (
        <BentoCard key={opt.value} multi={false} selected={value === opt.value} label={opt.label} onClick={() => onChange(opt.value)} />
      ))}
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
