import { describe, expect, it } from 'vitest'
import { MAX_LOGGED_QUERY_LENGTH, toLoggedSearch } from './search-query-log'

describe('toLoggedSearch', () => {
  it('keeps a short plain query, lower-cased and trimmed', () => {
    expect(toLoggedSearch('  Climate   Tech ', 3)).toEqual({
      query: 'climate tech',
      queryLength: 12,
      resultCount: 3,
    })
  })

  it('drops email addresses', () => {
    expect(toLoggedSearch('mail me a@b.com', 0).query).toBeNull()
  })

  it('drops urls', () => {
    expect(toLoggedSearch('https://example.org/x', 0).query).toBeNull()
    expect(toLoggedSearch('www.example.org', 0).query).toBeNull()
  })

  it('drops phone-like digit runs', () => {
    expect(toLoggedSearch('+91 98765 43210', 0).query).toBeNull()
    expect(toLoggedSearch('batch 2025', 1).query).toBe('batch 2025')
  })

  it('drops over-long text but still records the length', () => {
    const long = 'a'.repeat(MAX_LOGGED_QUERY_LENGTH + 1)
    const out = toLoggedSearch(long, 0)
    expect(out.query).toBeNull()
    expect(out.queryLength).toBe(MAX_LOGGED_QUERY_LENGTH + 1)
  })
})
