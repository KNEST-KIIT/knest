import { describe, expect, it } from 'vitest'
import {
  applyFacets,
  deriveFacets,
  hasActiveFacets,
  MIN_ITEMS_TO_FILTER,
  type FacetSource,
} from './facets'

type Item = { stage: string; sectors?: string[] }

const STAGE_OPTIONS = [
  { label: 'Idea', value: 'idea' },
  { label: 'MVP', value: 'mvp' },
  { label: 'Scaling', value: 'scaling' },
] as const

const SECTOR_OPTIONS = [
  { label: 'AI', value: 'ai' },
  { label: 'Health', value: 'health' },
] as const

const SOURCES: readonly FacetSource<Item>[] = [
  { key: 'stage', label: 'Stage', options: STAGE_OPTIONS, valuesOf: (i) => i.stage },
  { key: 'sector', label: 'Sector', options: SECTOR_OPTIONS, valuesOf: (i) => i.sectors },
]

/** `n` items alternating between two stages, so the stage facet is always worth showing. */
function items(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ stage: i % 2 === 0 ? 'idea' : 'mvp' }))
}

describe('deriveFacets', () => {
  it('offers nothing below the scanning threshold', () => {
    expect(deriveFacets(items(MIN_ITEMS_TO_FILTER - 1), SOURCES, {})).toEqual([])
  })

  it('offers a facet once enough items distinguish themselves by it', () => {
    const facets = deriveFacets(items(MIN_ITEMS_TO_FILTER), SOURCES, {})
    expect(facets.map((f) => f.key)).toEqual(['stage'])
  })

  it('drops a facet every item answers the same way', () => {
    const sameStage = Array.from({ length: 10 }, () => ({ stage: 'idea' }))
    expect(deriveFacets(sameStage, SOURCES, {})).toEqual([])
  })

  it('only offers option values that exist in the data', () => {
    const facets = deriveFacets(items(8), SOURCES, {})
    expect(facets[0]?.options.map((o) => o.value)).toEqual(['idea', 'mvp'])
  })

  it('keeps an active facet visible even when the rules would hide it', () => {
    // Two items is far below the threshold, but a visitor who arrived on a
    // filtered link still needs the control that clears it.
    const facets = deriveFacets([{ stage: 'idea' }, { stage: 'mvp' }], SOURCES, { stage: 'idea' })
    expect(facets.map((f) => f.key)).toEqual(['stage'])
  })

  it('keeps an active value in the list when nothing carries it any more', () => {
    const facets = deriveFacets(items(8), SOURCES, { stage: 'scaling' })
    expect(facets[0]?.options.map((o) => o.value)).toContain('scaling')
  })

  it('reads multi-valued fields', () => {
    const withSectors = items(8).map((item, i) => ({
      ...item,
      sectors: i % 2 === 0 ? ['ai'] : ['health', 'ai'],
    }))
    expect(deriveFacets(withSectors, SOURCES, {}).map((f) => f.key)).toEqual(['stage', 'sector'])
  })
})

describe('applyFacets', () => {
  it('returns everything when nothing is active', () => {
    expect(applyFacets(items(6), SOURCES, {})).toHaveLength(6)
  })

  it('narrows to the active value', () => {
    expect(applyFacets(items(6), SOURCES, { stage: 'idea' })).toHaveLength(3)
  })

  it('combines active facets', () => {
    const withSectors: Item[] = [
      { stage: 'idea', sectors: ['ai'] },
      { stage: 'idea', sectors: ['health'] },
      { stage: 'mvp', sectors: ['ai'] },
    ]
    expect(applyFacets(withSectors, SOURCES, { stage: 'idea', sector: 'ai' })).toEqual([
      { stage: 'idea', sectors: ['ai'] },
    ])
  })

  it('matches nothing for a stale or invented param value', () => {
    expect(applyFacets(items(6), SOURCES, { stage: 'not-a-stage' })).toEqual([])
  })

  it('ignores params that are not facets of this page', () => {
    expect(applyFacets(items(6), SOURCES, { q: 'search term' })).toHaveLength(6)
  })
})

describe('hasActiveFacets', () => {
  it('is false for no params and for unrelated ones', () => {
    expect(hasActiveFacets(SOURCES, {})).toBe(false)
    expect(hasActiveFacets(SOURCES, { q: 'anything' })).toBe(false)
  })

  it('is true when a facet param is set', () => {
    expect(hasActiveFacets(SOURCES, { sector: 'ai' })).toBe(true)
  })
})
