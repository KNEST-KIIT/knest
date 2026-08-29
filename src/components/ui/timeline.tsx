import { cn } from '@/lib/cn'

export type TimelineEntry = {
  label: string
  date?: string | null
  detail?: string | null
}

/**
 * A vertical sequence of dated entries. Built generically rather than as a
 * one-off "achievements list" — the same shape fits a startup's
 * achievements now and a founder's milestone view later (PRODUCT_ARCHITECTURE.md §7).
 */
export function Timeline({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  if (entries.length === 0) return null

  return (
    <ol className={cn('flex flex-col gap-4', className)}>
      {entries.map((entry, i) => (
        <li key={i} className="border-l-2 border-[var(--color-signal)] pl-4">
          <p className="font-medium">
            {entry.label}
            {entry.date && (
              <span className="ml-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                {entry.date}
              </span>
            )}
          </p>
          {entry.detail && (
            <p className="mt-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{entry.detail}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
