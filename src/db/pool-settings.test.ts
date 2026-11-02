import { describe, expect, it } from 'vitest'
import { poolSettings } from './pool-settings'

describe('poolSettings', () => {
  it('fails fast by default', () => {
    const s = poolSettings({}) as Record<string, number | boolean>
    expect(s.connectionTimeoutMillis).toBe(5_000)
    expect(s.statement_timeout).toBe(15_000)
    expect(s.query_timeout).toBeGreaterThan(s.statement_timeout as number)
    expect(s.max).toBe(10)
    expect(s.keepAlive).toBe(true)
  })

  it('takes positive overrides and ignores nonsense', () => {
    expect(poolSettings({ DB_POOL_MAX: '4', DB_STATEMENT_TIMEOUT_MS: '3000' })).toMatchObject({ max: 4, statement_timeout: 3000 })
    expect(poolSettings({ DB_POOL_MAX: '0', DB_STATEMENT_TIMEOUT_MS: 'abc' })).toMatchObject({ max: 10, statement_timeout: 15_000 })
  })

  it('lets the migration job switch statement timeouts off', () => {
    const s = poolSettings({ DB_STATEMENT_TIMEOUT_MS: '0' })
    expect(s).not.toHaveProperty('statement_timeout')
    expect(s).not.toHaveProperty('query_timeout')
  })
})
