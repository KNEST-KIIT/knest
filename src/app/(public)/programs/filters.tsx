'use client'

import { STAGE_OPTIONS, SECTOR_OPTIONS, AUDIENCE_OPTIONS, FORMAT_OPTIONS } from '@/payload/fields/taxonomy'
import { FilterBar } from '@/components/ui'

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

export function ProgramFilters() {
  return <FilterBar basePath="/programs" filters={FILTERS} />
}
