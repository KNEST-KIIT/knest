'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import { Select } from '@/components/ui'

const FORMAT_OPTIONS = [
  { label: 'Guide', value: 'guide' },
  { label: 'Template', value: 'template' },
  { label: 'Playbook', value: 'playbook' },
  { label: 'Video', value: 'video' },
  { label: 'Article', value: 'article' },
  { label: 'Worksheet', value: 'worksheet' },
]

const FILTERS = [
  { key: 'stage', label: 'Stage', options: STAGE_OPTIONS },
  { key: 'format', label: 'Format', options: FORMAT_OPTIONS },
] as const

export function ResourceFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/resources?${params.toString()}`)
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
          onClick={() => router.push('/resources')}
          className="h-12 self-end text-[length:var(--text-small)] text-[var(--color-ink-muted)] underline"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
