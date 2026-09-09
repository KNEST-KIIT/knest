/**
 * Every human-readable label for a stored enum value, in one place.
 *
 * Before this file the same maps were re-typed per page — `FORMAT_LABELS` in
 * both /resources and /resources/[slug], `TYPE_LABELS` in both /events and
 * /events/[slug], `SPACE_TYPE_LABELS` and `PARTNER_TYPE_LABELS` inline in
 * /ecosystem — and two pages skipped them entirely, rendering raw values:
 * /startups printed `early_revenue` and `social_impact` into tags a visitor
 * had to decode. A label is content, so it belongs where content is decided
 * once, not where it happens to be rendered.
 */

import {
  AUDIENCE_OPTIONS,
  EXPERTISE_OPTIONS,
  FORMAT_OPTIONS,
  SECTOR_OPTIONS,
  STAGE_OPTIONS,
} from '@/payload/fields/taxonomy'

type Option = { readonly label: string; readonly value: string }

/** Falls back to the raw value rather than an empty string: an unlabelled new option should look unfinished, not invisible. */
function lookup(options: readonly Option[], value: string | null | undefined): string {
  if (!value) return ''
  return options.find((o) => o.value === value)?.label ?? value
}

function toLabeller(options: readonly Option[]) {
  return (value: string | null | undefined) => lookup(options, value)
}

export const stageLabel = toLabeller(STAGE_OPTIONS)
export const sectorLabel = toLabeller(SECTOR_OPTIONS)
export const audienceLabel = toLabeller(AUDIENCE_OPTIONS)
export const formatLabel = toLabeller(FORMAT_OPTIONS)
export const expertiseLabel = toLabeller(EXPERTISE_OPTIONS)

/** Collection-specific vocabularies that aren't shared taxonomy, kept here so pages and detail views can't drift apart. */
export const EVENT_TYPE_OPTIONS = [
  { label: 'Workshop', value: 'workshop' },
  { label: 'Talk', value: 'talk' },
  { label: 'Ideation session', value: 'ideation' },
  { label: 'Demo day', value: 'demo_day' },
  { label: 'Networking', value: 'networking' },
  { label: 'Hackathon', value: 'hackathon' },
  { label: 'Office hours', value: 'office_hours' },
] as const

export const RESOURCE_FORMAT_OPTIONS = [
  { label: 'Guide', value: 'guide' },
  { label: 'Template', value: 'template' },
  { label: 'Playbook', value: 'playbook' },
  { label: 'Video', value: 'video' },
  { label: 'Article', value: 'article' },
  { label: 'Worksheet', value: 'worksheet' },
] as const

export const APPLICATION_STATUS_OPTIONS = [
  { label: 'Applications open', value: 'open' },
  { label: 'Opening soon', value: 'opening_soon' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Closed', value: 'closed' },
] as const

export const SPACE_TYPE_OPTIONS = [
  { label: 'Flexible co-working space', value: 'coworking' },
  { label: 'Modular startup studio', value: 'startup_studio' },
  { label: 'Collaboration zone', value: 'collaboration_zone' },
  { label: 'Maker lab', value: 'maker_lab' },
  { label: 'Digital content studio', value: 'digital_studio' },
  { label: 'Founder cabin', value: 'founder_cabin' },
  { label: 'Pre-incubation space', value: 'pre_incubation_space' },
  { label: 'Event space', value: 'event_space' },
  { label: 'Meeting room', value: 'meeting_room' },
] as const

export const PARTNER_TYPE_OPTIONS = [
  { label: 'Industry', value: 'industry' },
  { label: 'Academic', value: 'academic' },
  { label: 'Government', value: 'government' },
  { label: 'Investor', value: 'investor' },
  { label: 'Community', value: 'community' },
] as const

export const eventTypeLabel = toLabeller(EVENT_TYPE_OPTIONS)
export const resourceFormatLabel = toLabeller(RESOURCE_FORMAT_OPTIONS)
export const spaceTypeLabel = toLabeller(SPACE_TYPE_OPTIONS)
export const partnerTypeLabel = toLabeller(PARTNER_TYPE_OPTIONS)
