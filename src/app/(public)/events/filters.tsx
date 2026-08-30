'use client'

import { FORMAT_OPTIONS, STAGE_OPTIONS } from '@/payload/fields/taxonomy'
import { FilterBar } from '@/components/ui'

const EVENT_TYPE_OPTIONS = [
  { label: 'Workshop', value: 'workshop' },
  { label: 'Talk', value: 'talk' },
  { label: 'Ideation session', value: 'ideation' },
  { label: 'Demo day', value: 'demo_day' },
  { label: 'Networking', value: 'networking' },
  { label: 'Hackathon', value: 'hackathon' },
  { label: 'Office hours', value: 'office_hours' },
]

const FILTERS = [
  { key: 'eventType', label: 'Type', options: EVENT_TYPE_OPTIONS },
  { key: 'format', label: 'Format', options: FORMAT_OPTIONS },
  { key: 'stage', label: 'Stage', options: STAGE_OPTIONS },
] as const

export function EventFilters() {
  return <FilterBar basePath="/events" filters={FILTERS} />
}
