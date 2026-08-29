'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SECTOR_OPTIONS, STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import { Select } from '@/components/ui'

const FILTERS = [
  { key: 'stage', label: 'Stage', options: STAGE_OPTIONS },
  { key: 'sector', label: 'Sector', options: SECTOR_OPTIONS },
] as const

/** Same URL-search-param pattern as (public)/programs/filters.tsx and (public)/events/filters.tsx. */
export function StartupFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/startups?${params.toString()}`)
  }

  const hasFilters = FILTERS.some((f) => searchParams.get(f.key))

  return (
    <div className="flex flex-wrap items-end gap-4">
      {FILTERS.map((filter) => (
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
          onClick={() => router.push('/startups')}
          className="h-12 self-end text-[length:var(--text-small)] text-[var(--color-ink-muted)] underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
