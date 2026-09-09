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
 *
 * What it renders is decided upstream by `src/lib/facets.ts`, from the
 * content that actually exists. An empty config renders nothing: a listing
 * with four cards shows four cards, not four cards under five dropdowns.
 */
export function FilterBar({
  basePath,
  filters,
  label = 'Filter results',
}: {
  basePath: string
  filters: readonly FilterConfig[]
  /** Names the group for screen readers, which otherwise meet loose selects with no shared context. */
  label?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (filters.length === 0) return null

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const query = params.toString()
    router.push(query ? `${basePath}?${query}` : basePath)
  }

  function clearAll() {
    // Only the filter keys are dropped — a search term or any other param
    // the page carries survives, so "Clear all" widens the result set
    // instead of navigating somewhere else entirely.
    const params = new URLSearchParams(searchParams.toString())
    for (const filter of filters) params.delete(filter.key)
    const query = params.toString()
    router.push(query ? `${basePath}?${query}` : basePath)
  }

  const activeCount = filters.filter((f) => searchParams.get(f.key)).length

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-end gap-4">
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
      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="h-12 self-end text-[length:var(--text-small)] text-[var(--color-ink-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
        >
          Clear {activeCount === 1 ? 'filter' : 'all filters'}
        </button>
      )}
    </div>
  )
}
