import { cn } from '@/lib/cn'

export type StatusTone = 'neutral' | 'signal' | 'positive' | 'caution' | 'critical' | 'archive'
type Tone = StatusTone

const tones: Record<Tone, string> = {
  neutral: 'bg-[var(--color-paper-soft)] text-[var(--color-ink-soft)]',
  signal: 'bg-[var(--color-signal-wash)] text-[var(--color-signal-deep)]',
  positive: 'bg-[color-mix(in_srgb,var(--color-positive)_12%,white)] text-[var(--color-positive)]',
  caution: 'bg-[color-mix(in_srgb,var(--color-caution)_12%,white)] text-[var(--color-caution)]',
  critical: 'bg-[color-mix(in_srgb,var(--color-critical)_10%,white)] text-[var(--color-critical)]',
  archive: 'bg-[var(--color-archive-soft)] text-[var(--color-archive)]',
}

export function Tag({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        // `w-fit` because `inline-flex` does not stop a flex child being
        // stretched across its container's cross axis. Every card in the app
        // is a `flex flex-col`, so the status pill at the top of a program,
        // startup or event card was rendering as a full-width bar across the
        // card rather than a pill hugging its label. An explicit width beats
        // `align-items: stretch`, and is inert outside a flex or grid parent,
        // so this is safe everywhere Tag is already used.
        'inline-flex w-fit items-center rounded-[var(--radius-sm)] px-2.5 py-1',
        'text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.08em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Status shown as a dot AND a label. The dot alone would make status a
 * colour-only signal, which fails for anyone who cannot distinguish the hues.
 */
export function StatusDot({ tone = 'neutral', label }: { tone?: Tone; label: string }) {
  const dot: Record<Tone, string> = {
    neutral: 'bg-[var(--color-ink-muted)]',
    signal: 'bg-[var(--color-signal)]',
    positive: 'bg-[var(--color-positive)]',
    caution: 'bg-[var(--color-caution)]',
    critical: 'bg-[var(--color-critical)]',
    archive: 'bg-[var(--color-archive)]',
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', dot[tone])} />
      <span className="text-[length:var(--text-small)] font-semibold uppercase tracking-[0.06em]">
        {label}
      </span>
    </span>
  )
}
