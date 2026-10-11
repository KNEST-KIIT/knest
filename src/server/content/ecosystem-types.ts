/**
 * Homepage counters. Every figure here is a count of published rows in the
 * CMS at request time. There is no stored or typed-in number anywhere, and
 * `visibleCount` makes zero and unknown values disappear instead of rendering
 * "0 programs" or a guess (KN-01).
 */
export interface EcosystemCounts {
  programs: number | null
  mentors: number | null
  startups: number | null
  upcomingEvents: number | null
  spaces: number | null
  industryPartners: number | null
  investors: number | null
  academicPartners: number | null
  governmentPartners: number | null
  communityPartners: number | null
}

/** A count is shown only when it is a positive integer. */
export function visibleCount(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

export const UNKNOWN_COUNTS: EcosystemCounts = {
  programs: null,
  mentors: null,
  startups: null,
  upcomingEvents: null,
  spaces: null,
  industryPartners: null,
  investors: null,
  academicPartners: null,
  governmentPartners: null,
  communityPartners: null,
}
