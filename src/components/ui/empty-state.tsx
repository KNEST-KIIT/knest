import { cn } from '@/lib/cn'

/**
 * A first-class component, not a fallback.
 *
 * KNEST launches with almost no content, so this is one of the most-seen
 * surfaces in the product. Every empty state says three things: what belongs
 * here, why it is not here yet, and what to do meanwhile. It never says "no
 * data available", and it never renders as a collapsed strip — an empty
 * section at full height reads as deliberate; a squashed one reads as broken.
 */
export function EmptyState({
  heading,
  body,
  action,
  size = 'default',
  className,
}: {
  heading: string
  body: string
  action?: React.ReactNode
  size?: 'default' | 'compact'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)]',
        'bg-[var(--color-paper-soft)]',
        size === 'compact' ? 'px-6 py-12' : 'px-6 py-20 md:py-28',
        className,
      )}
    >
      <h3
        className={cn(
          'font-[family-name:var(--font-display)] font-bold uppercase tracking-tight',
          size === 'compact'
            ? 'text-[length:var(--text-heading)]'
            : 'text-[length:var(--text-title)]',
        )}
      >
        {heading}
      </h3>
      <p className="mt-4 max-w-[46ch] text-[var(--color-ink-soft)]">{body}</p>
      {action && <div className="mt-8">{action}</div>}
    </div>
  )
}
