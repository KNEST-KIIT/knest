'use client'

import { useRouter, useSearchParams } from 'next/navigation'
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

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${basePath}?${params.toString()}`)
  }

  const hasFilters = filters.some((f) => searchParams.get(f.key))

  return (
    <div className="flex flex-wrap items-end gap-4">
      {filters.map((filter) => (
        <label key={filter.key} className="flex flex-col gap-1.5">
          <span className="text-[length:var(--text-small)] font-medium">{filter.label}</span>
          <Select
            value={searchParams.get(filter.key) ?? ''}
            onChange={(e) => setFilter(filter.key, e.target.value)}
            className="min-w-[10rem]"
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
      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className="h-12 self-end text-[length:var(--text-small)] text-[var(--color-ink-muted)] underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
