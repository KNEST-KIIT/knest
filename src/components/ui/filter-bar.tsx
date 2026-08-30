'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { duration, ease } from '@/lib/motion'
import { Select } from './field'

export type FilterConfig = {
  key: string
  label: string
  options: readonly { label: string; value: string }[]
}

/**
 * Filters live entirely in the URL (UX_WIREFRAMES.md §3): server-rendered,
 * shareable, correct on back/forward, no client-side filter state to keep in
 * sync. Extracted after this exact component (not just its logic) was
 * hand-copied byte-for-byte across programs/events/startups' own
 * filters.tsx (PHASE-7-9-RETROSPECTIVE.md §2) — a page now passes its own
 * `filters` config and gets the whole bar, rather than re-deriving the
 * setFilter/hasFilters/"Clear all" behavior a fourth or fifth time.
 *
 * Two things changed after looking at it on a phone.
 *
 * The bar was `flex flex-wrap` with each select sized to its own content, so
 * five filters wrapped into a ragged 2-1-1-1 stack of four different widths.
 * It is now a grid: every control is the same width, and the columns are the
 * same at every breakpoint.
 *
 * More importantly, on a 390px screen those five controls filled roughly 800
 * vertical pixels — the entire first screen and most of the second — so
 * someone arriving at /programs scrolled past a form before reaching a single
 * result. Below `md` the bar collapses behind a disclosure that names how
 * many filters are active, and results start immediately. It is open by
 * default on desktop, where the space is not contested.
 */
export function FilterBar({
  basePath,
  filters,
}: {
  basePath: string
  filters: readonly FilterConfig[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${basePath}?${params.toString()}`)
  }

  const activeCount = filters.filter((f) => searchParams.get(f.key)).length
  const hasFilters = activeCount > 0

  const controls = (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {filters.map((filter) => (
        <label key={filter.key} className="flex flex-col gap-1.5">
          <span className="text-[length:var(--text-small)] font-medium">{filter.label}</span>
          <Select
            value={searchParams.get(filter.key) ?? ''}
            onChange={(e) => setFilter(filter.key, e.target.value)}
          >
            <option value="">Any</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>
      ))}
    </div>
  )

  return (
    <div>
      {/* The mobile toggle. Hidden from desktop entirely rather than styled
          away, so it is not a stray tab stop for a keyboard user there. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="filter-controls"
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-[var(--radius-md)] border px-4 md:hidden',
          'text-[length:var(--text-small)] font-medium',
          'transition-colors duration-[var(--duration-instant)]',
          hasFilters
            ? 'border-[var(--color-signal)] bg-[var(--color-signal-wash)] text-[var(--color-signal-deep)]'
            : 'border-[var(--color-line)] bg-white',
        )}
      >
        <span>
          Filters
          {hasFilters && ` · ${activeCount}`}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={cn(
            'size-4 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
            open && 'rotate-180',
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <div id="filter-controls">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: duration.base, ease: ease.entrance }}
              className="overflow-hidden md:hidden"
            >
              <div className="pt-4">{controls}</div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="hidden md:block">{controls}</div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className="mt-4 inline-flex h-11 items-center text-[length:var(--text-small)] text-[var(--color-ink-muted)] underline hover:text-[var(--color-ink)]"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
