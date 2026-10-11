import { describe, expect, it } from 'vitest'
import { assertRoleName, privilegeStatements } from './runtime-role'

describe('runtime database role', () => {
  it('accepts a plain role name and refuses reserved or unsafe ones', () => {
    expect(assertRoleName('knest_app')).toBe('knest_app')
    for (const bad of ['', 'ab', 'Knest', 'knest-app', 'postgres', 'pg_monitor', 'rds_superuser', 'a;drop table x', 'x'.repeat(40)]) {
      expect(() => assertRoleName(bad), bad).toThrow()
    }
  })

  it('grants row access only: no DDL, no role management, no TRUNCATE', () => {
    const all = privilegeStatements('knest_app', 'knest_admin', 'knest').join('\n')
    expect(all).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "app"/)
    expect(all).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "cms"/)
    expect(all).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE "knest_admin" IN SCHEMA "app"/)
    for (const forbidden of [/TRUNCATE/i, /\bCREATE\b/i, /\bALL PRIVILEGES\b/i, /SUPERUSER/i, /CREATEROLE/i, /WITH GRANT OPTION/i]) {
      expect(all).not.toMatch(forbidden)
    }
  })

  it('quotes identifiers', () => {
    const all = privilegeStatements('knest_app', 'a"b', 'db"x').join('\n')
    expect(all).toContain('"a""b"')
    expect(all).toContain('"db""x"')
  })
})
