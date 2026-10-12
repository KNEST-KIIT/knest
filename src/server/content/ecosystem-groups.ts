import { visibleCount, type EcosystemCounts } from './ecosystem-types'

export interface EcosystemStat {
  key: string
  label: string
  value: number
  href: string
}

export interface EcosystemGroup {
  key: 'academia' | 'industry' | 'public'
  title: string
  stats: EcosystemStat[]
}

type Spec = { key: keyof EcosystemCounts; singular: string; plural: string; href: string }

const GROUPS: { key: EcosystemGroup['key']; title: string; specs: Spec[] }[] = [
  {
    key: 'academia',
    title: 'Academia',
    specs: [
      { key: 'programs', singular: 'program', plural: 'programs', href: '/programs' },
      { key: 'mentors', singular: 'mentor', plural: 'mentors', href: '/mentors' },
      { key: 'spaces', singular: 'space', plural: 'spaces', href: '/ecosystem#infrastructure' },
      { key: 'academicPartners', singular: 'academic partner', plural: 'academic partners', href: '/ecosystem#partners' },
    ],
  },
  {
    key: 'industry',
    title: 'Industry',
    specs: [
      { key: 'industryPartners', singular: 'industry partner', plural: 'industry partners', href: '/ecosystem#partners' },
      { key: 'investors', singular: 'investor', plural: 'investors', href: '/ecosystem#partners' },
      { key: 'startups', singular: 'startup', plural: 'startups', href: '/startups' },
    ],
  },
  {
    key: 'public',
    title: 'Government and community',
    specs: [
      { key: 'governmentPartners', singular: 'government partner', plural: 'government partners', href: '/ecosystem#partners' },
      { key: 'communityPartners', singular: 'community partner', plural: 'community partners', href: '/ecosystem#partners' },
      { key: 'upcomingEvents', singular: 'upcoming event', plural: 'upcoming events', href: '/events' },
    ],
  },
]

/**
 * Turns raw counts into the groups the homepage shows. A stat with a zero or
 * unknown count is dropped, and a group with no stats is dropped, so a young
 * platform shows a short honest section (or none) rather than a row of zeros.
 */
export function buildEcosystemGroups(counts: EcosystemCounts): EcosystemGroup[] {
  return GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    stats: group.specs.flatMap((spec): EcosystemStat[] => {
      const value = visibleCount(counts[spec.key])
      if (value === null) return []
      return [{ key: spec.key, label: value === 1 ? spec.singular : spec.plural, value, href: spec.href }]
    }),
  })).filter((group) => group.stats.length > 0)
}
