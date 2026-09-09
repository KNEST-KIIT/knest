/**
 * Filters that earn their place.
 *
 * Every public listing used to render its full filter bar unconditionally —
 * /programs offered five dropdowns, /events three — over collections that
 * ship empty and will hold a handful of entries for KNEST's first year. A
 * filter over four cards is not a convenience: it is five taps to reach a
 * subset the visitor could already see, and it advertises depth the site
 * does not have. So a facet is now derived from the content that actually
 * exists, and a control appears only when using it could change what is on
 * screen.
 *
 * Three rules, all of them the same rule from different sides:
 *
 * 1. Below `MIN_ITEMS_TO_FILTER` results, no filters at all — scanning is
 *    faster than filtering, and the visitor can see the whole set anyway.
 * 2. A facet needs at least two distinct values present in the data. One
 *    value filters nothing; zero values is a dropdown of dead options.
 * 3. A facet already active in the URL is always shown, whatever the two
 *    rules above say — a shared or bookmarked link must still offer the
 *    control that clears it, or the visitor is stuck in a filtered view
 *    with no way out but editing the address bar.
 *
 * The same `valuesOf` accessor both derives a facet and matches against it,
 * so the options a visitor is offered and the results they get back cannot
 * drift apart.
 */

import type { FilterConfig } from '@/components/ui/filter-bar'

export type FacetSource<T> = {
  /** The URL search param this facet reads and writes. */
  key: string
  label: string
  options: readonly { readonly label: string; readonly value: string }[]
  /** The value or values this item carries for the facet. */
  valuesOf: (item: T) => string | string[] | null | undefined
}

/** Under six results, a filter bar costs more than it returns. */
export const MIN_ITEMS_TO_FILTER = 6

export type ActiveFilters = Record<string, string | undefined>

function valuesFor<T>(source: FacetSource<T>, item: T): string[] {
  const raw = source.valuesOf(item)
  if (raw == null) return []
  return (Array.isArray(raw) ? raw : [raw]).filter((v): v is string => typeof v === 'string' && v.length > 0)
}

/** Items matching every active filter. An unknown or stale param value simply matches nothing, which the caller renders as "no matches". */
export function applyFacets<T>(items: T[], sources: readonly FacetSource<T>[], active: ActiveFilters): T[] {
  const engaged = sources.filter((source) => active[source.key])
  if (engaged.length === 0) return items

  return items.filter((item) =>
    engaged.every((source) => valuesFor(source, item).includes(active[source.key] as string)),
  )
}

/** True when any recognised facet is set — the pages use this for their "no matches" copy and their result summaries. */
export function hasActiveFacets<T>(sources: readonly FacetSource<T>[], active: ActiveFilters): boolean {
  return sources.some((source) => Boolean(active[source.key]))
}

/**
 * The filter controls worth rendering, each narrowed to the options that
 * exist in the data. Returns an empty array when nothing is worth showing,
 * and `FilterBar` renders nothing at all for an empty array.
 *
 * `items` must be the *unfiltered* collection. Deriving facets from already
 * filtered results would make each choice erase the controls that produced
 * it — pick a stage, and the stage dropdown disappears.
 */
export function deriveFacets<T>(
  allItems: T[],
  sources: readonly FacetSource<T>[],
  active: ActiveFilters,
): FilterConfig[] {
  const enoughToFilter = allItems.length >= MIN_ITEMS_TO_FILTER

  return sources.flatMap((source) => {
    const present = new Set<string>()
    for (const item of allItems) for (const value of valuesFor(source, item)) present.add(value)

    const isActive = Boolean(active[source.key])
    if (!isActive && (!enoughToFilter || present.size < 2)) return []

    // An active value is kept in the list even if nothing carries it any
    // more, so the control still shows what is being filtered on.
    const options = source.options.filter(
      (option) => present.has(option.value) || option.value === active[source.key],
    )
    if (options.length === 0) return []

    return [{ key: source.key, label: source.label, options }]
  })
}
