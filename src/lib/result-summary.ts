/**
 * The count + pluralization + qualifier text next to a filter bar
 * (UX_WIREFRAMES.md §3), hand-copied five times across
 * programs/events/resources/startups/mentors' list pages
 * (PHASE-7-9-RETROSPECTIVE.md §2) before being extracted here.
 */
export function resultSummary(
  count: number,
  noun: string,
  options: {
    hasFilters: boolean
    emptyNoFilters: string
    /** Overrides the default `No ${noun}s match that combination.` for the zero-with-filters case. */
    emptyWithFilters?: string
    /** Overrides the default `match your filters` suffix on a populated result (e.g. "for Fundraising"). */
    qualifier?: string
  },
): string {
  const { hasFilters, emptyNoFilters, emptyWithFilters, qualifier } = options

  if (count === 0) {
    if (!hasFilters) return emptyNoFilters
    return emptyWithFilters ?? `No ${noun}s match that combination.`
  }

  const suffix = qualifier ?? (hasFilters ? 'match your filters' : '')
  return `${count} ${noun}${count === 1 ? '' : 's'}${suffix ? ` ${suffix}` : ''}.`
}
