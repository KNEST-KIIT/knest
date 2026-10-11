import { describe, expect, it } from 'vitest'
import { buildEcosystemGroups } from './ecosystem-groups'
import { visibleCount, type EcosystemCounts } from './ecosystem-types'

const ZERO: EcosystemCounts = {
  programs: 0,
  mentors: 0,
  startups: 0,
  upcomingEvents: 0,
  spaces: 0,
  industryPartners: 0,
  investors: 0,
  academicPartners: 0,
  governmentPartners: 0,
  communityPartners: 0,
}

describe('visibleCount', () => {
  it('hides zero, null and non-integers', () => {
    expect(visibleCount(0)).toBeNull()
    expect(visibleCount(null)).toBeNull()
    expect(visibleCount(undefined)).toBeNull()
    expect(visibleCount(1.5)).toBeNull()
    expect(visibleCount(-2)).toBeNull()
    expect(visibleCount(4)).toBe(4)
  })
})

describe('buildEcosystemGroups', () => {
  it('returns nothing when every count is zero or unknown', () => {
    expect(buildEcosystemGroups(ZERO)).toEqual([])
    expect(buildEcosystemGroups({ ...ZERO, programs: null, mentors: null })).toEqual([])
  })

  it('drops empty groups and zero stats, keeps the rest', () => {
    const groups = buildEcosystemGroups({ ...ZERO, programs: 3, startups: 1 })
    expect(groups.map((g) => g.key)).toEqual(['academia', 'industry'])
    expect(groups[0]?.stats).toEqual([{ key: 'programs', label: 'programs', value: 3, href: '/programs' }])
    expect(groups[1]?.stats[0]).toMatchObject({ key: 'startups', label: 'startup', value: 1 })
  })
})
