'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { STAGE_OPTIONS, SECTOR_OPTIONS, AUDIENCE_OPTIONS, FORMAT_OPTIONS } from '@/payload/fields/taxonomy'
import { Select } from '@/components/ui'

const STATUS_OPTIONS = [
  { label: 'Applications open', value: 'open' },
  { label: 'Opening soon', value: 'opening_soon' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Closed', value: 'closed' },
]

const FILTERS = [
  { key: 'stage', label: 'Stage', options: STAGE_OPTIONS },
  { key: 'sector', label: 'Sector', options: SECTOR_OPTIONS },
  { key: 'audience', label: 'Who it’s for', options: AUDIENCE_OPTIONS },
  { key: 'format', label: 'Format', options: FORMAT_OPTIONS },
  { key: 'status', label: 'Status', options: STATUS_OPTIONS },
] as const

/**
 * Filters live entirely in the URL (UX_WIREFRAMES.md §3): server-rendered,
 * shareable, correct on back/forward, and they survive a refresh. There is no
 * client-side filter state to keep in sync with the URL.
 */
export function ProgramFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/programs?${params.toString()}`)
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
          onClick={() => router.push('/programs')}
          className="h-12 self-end text-[length:var(--text-small)] text-[var(--color-ink-muted)] underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
