/**
 * Shared vocabulary. Defined once so a program, a startup, a resource and an
 * event all describe stage and sector the same way — which is what lets the
 * recommender, the filters and the search index line up instead of each
 * carrying a private list of near-synonyms.
 */

export const STAGE_OPTIONS = [
  { label: 'Exploring', value: 'exploring' },
  { label: 'Idea', value: 'idea' },
  { label: 'Validation', value: 'validation' },
  { label: 'MVP', value: 'mvp' },
  { label: 'Early revenue', value: 'early_revenue' },
  { label: 'Scaling', value: 'scaling' },
  { label: 'Established', value: 'established' },
] as const

export const SECTOR_OPTIONS = [
  { label: 'AI', value: 'ai' },
  { label: 'FinTech', value: 'fintech' },
  { label: 'Health', value: 'health' },
  { label: 'Climate', value: 'climate' },
  { label: 'DeepTech', value: 'deeptech' },
  { label: 'SaaS', value: 'saas' },
  { label: 'Consumer', value: 'consumer' },
  { label: 'Education', value: 'education' },
  { label: 'Hardware', value: 'hardware' },
  { label: 'Agriculture', value: 'agriculture' },
  { label: 'Mobility', value: 'mobility' },
  { label: 'Space', value: 'space' },
  { label: 'Social impact', value: 'social_impact' },
  { label: 'Media', value: 'media' },
  { label: 'Gaming', value: 'gaming' },
] as const

export const AUDIENCE_OPTIONS = [
  { label: 'Students', value: 'students' },
  { label: 'Aspiring founders', value: 'aspiring_founders' },
  { label: 'Founders with a team', value: 'founders' },
  { label: 'Researchers', value: 'researchers' },
  { label: 'Alumni', value: 'alumni' },
] as const

export const FORMAT_OPTIONS = [
  { label: 'In person', value: 'in_person' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'Online', value: 'online' },
] as const

export const EXPERTISE_OPTIONS = [
  { label: 'Product', value: 'product' },
  { label: 'Fundraising', value: 'fundraising' },
  { label: 'Go-to-market', value: 'gtm' },
  { label: 'Technology', value: 'technology' },
  { label: 'Legal & IP', value: 'legal' },
  { label: 'Hiring', value: 'hiring' },
  { label: 'Industry', value: 'industry' },
  { label: 'Design', value: 'design' },
  { label: 'Operations', value: 'operations' },
] as const

export type StageValue = (typeof STAGE_OPTIONS)[number]['value']
export type SectorValue = (typeof SECTOR_OPTIONS)[number]['value']
export type ExpertiseValue = (typeof EXPERTISE_OPTIONS)[number]['value']
