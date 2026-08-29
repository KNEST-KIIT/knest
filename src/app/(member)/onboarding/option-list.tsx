'use client'

/**
 * The radio/checkbox-styled option rows from UX_WIREFRAMES.md §6 — full-width
 * rows rather than a native <select>, so every choice is visible at once and
 * reachable with arrow keys as a proper radio/checkbox group.
 */

type Option = { value: string; label: string }

function Row({
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
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-[var(--color-line)] px-4 py-4 text-left text-[length:var(--text-body)] transition-colors last:border-b-0 hover:bg-[var(--color-paper-soft)] ${
        selected ? 'bg-[var(--color-signal-wash)]' : ''
      }`}
    >
      <span
        aria-hidden
        className={`flex size-5 shrink-0 items-center justify-center border-2 ${
          multi ? 'rounded-[var(--radius-sm)]' : 'rounded-full'
        } ${selected ? 'border-[var(--color-signal)] bg-[var(--color-signal)]' : 'border-[var(--color-line)]'}`}
      >
        {selected && <span className="size-2 rounded-full bg-white" />}
      </span>
      {label}
    </button>
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
    <div role="radiogroup" className="rounded-[var(--radius-md)] border border-[var(--color-line)]">
      {options.map((opt) => (
        <Row key={opt.value} multi={false} selected={value === opt.value} label={opt.label} onClick={() => onChange(opt.value)} />
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
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)]">
      {options.map((opt) => (
        <Row key={opt.value} multi selected={value.includes(opt.value)} label={opt.label} onClick={() => toggle(opt.value)} />
      ))}
    </div>
  )
}
