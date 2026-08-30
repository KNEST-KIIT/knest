'use client'

import { SECTOR_OPTIONS, STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import { FilterBar } from '@/components/ui'

const FILTERS = [
  { key: 'stage', label: 'Stage', options: STAGE_OPTIONS },
  { key: 'sector', label: 'Sector', options: SECTOR_OPTIONS },
] as const

export function StartupFilters() {
  return <FilterBar basePath="/startups" filters={FILTERS} />
}
