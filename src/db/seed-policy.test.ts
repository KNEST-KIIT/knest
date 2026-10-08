import { describe, expect, it } from 'vitest'
import {
  assertDemoSeedAllowed,
  databaseHost,
  isLocalDatabase,
  looksLikeProduction,
  mayModifyExistingUsers,
  resolveSeedPassword,
} from './seed-policy'

const LOCAL = 'postgres://knest:knest@127.0.0.1:5432/knest'
const REMOTE = 'postgres://u:p@db.example-host.net:5432/app'

describe('databaseHost / isLocalDatabase', () => {
  it('parses hosts and rejects garbage', () => {
    expect(databaseHost(LOCAL)).toBe('127.0.0.1')
    expect(databaseHost('not a url')).toBeNull()
    expect(databaseHost(undefined)).toBeNull()
  })
  it('treats only loopback/docker hosts as local', () => {
    expect(isLocalDatabase({ DATABASE_URL: LOCAL })).toBe(true)
    expect(isLocalDatabase({ DATABASE_URL: 'postgres://u@localhost/db' })).toBe(true)
    expect(isLocalDatabase({ DATABASE_URL: REMOTE })).toBe(false)
    expect(isLocalDatabase({ DATABASE_URL: 'postgres://u@localhost.evil.com/db' })).toBe(false)
    expect(isLocalDatabase({})).toBe(false)
  })
})

describe('looksLikeProduction', () => {
  it('detects NODE_ENV, APP_ENV and VERCEL_ENV', () => {
    expect(looksLikeProduction({ NODE_ENV: 'production' })).toBe(true)
    expect(looksLikeProduction({ APP_ENV: 'production' })).toBe(true)
    expect(looksLikeProduction({ VERCEL_ENV: 'production' })).toBe(true)
    expect(looksLikeProduction({ NODE_ENV: 'development' })).toBe(false)
    expect(looksLikeProduction({})).toBe(false)
  })
})

describe('resolveSeedPassword', () => {
  it('allows the dev default only for a local DB outside production', () => {
    expect(resolveSeedPassword({ DATABASE_URL: LOCAL })).toBe('knest-dev-password')
  })
  it('refuses the default in production even for a local-looking DB', () => {
    expect(() => resolveSeedPassword({ DATABASE_URL: LOCAL, NODE_ENV: 'production' })).toThrow(/SEED_PASSWORD/)
  })
  it('refuses the default against a non-local DB when NODE_ENV is unset (the tsx case)', () => {
    expect(() => resolveSeedPassword({ DATABASE_URL: REMOTE })).toThrow(/SEED_PASSWORD/)
  })
  it('refuses when DATABASE_URL is missing', () => {
    expect(() => resolveSeedPassword({})).toThrow()
  })
  it('accepts an explicit long password anywhere', () => {
    expect(resolveSeedPassword({ DATABASE_URL: REMOTE, NODE_ENV: 'production', SEED_PASSWORD: 'a-long-unique-secret-1' })).toBe(
      'a-long-unique-secret-1',
    )
  })
  it('rejects short passwords and the published default as explicit values', () => {
    expect(() => resolveSeedPassword({ DATABASE_URL: LOCAL, SEED_PASSWORD: 'short' })).toThrow(/12/)
    expect(() => resolveSeedPassword({ DATABASE_URL: LOCAL, SEED_PASSWORD: 'knest-dev-password' })).toThrow(/default/)
  })
})

describe('assertDemoSeedAllowed', () => {
  it('allows a local non-production database', () => {
    expect(() => assertDemoSeedAllowed({ DATABASE_URL: LOCAL }, 'demo')).not.toThrow()
  })
  it('refuses production regardless of the opt-in', () => {
    expect(() => assertDemoSeedAllowed({ DATABASE_URL: LOCAL, NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' }, 'demo')).toThrow(/production/)
  })
  it('refuses a non-local database without the explicit opt-in', () => {
    expect(() => assertDemoSeedAllowed({ DATABASE_URL: REMOTE }, 'demo')).toThrow(/non-local/)
    expect(() => assertDemoSeedAllowed({ DATABASE_URL: REMOTE, ALLOW_DEMO_SEED: 'true' }, 'demo')).not.toThrow()
  })
})

describe('mayModifyExistingUsers', () => {
  it('is off by default and never on in production', () => {
    expect(mayModifyExistingUsers({})).toBe(false)
    expect(mayModifyExistingUsers({ SEED_RESET_EXISTING: 'true' })).toBe(true)
    expect(mayModifyExistingUsers({ SEED_RESET_EXISTING: 'true', NODE_ENV: 'production' })).toBe(false)
  })
})
