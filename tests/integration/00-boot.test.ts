import { afterAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, db, get } from '../support/helpers'

afterAll(closeDb)

describe('test environment', () => {
  it('has both schemas on a real PostgreSQL 16', async () => {
    const v = await db().query('show server_version')
    expect(String(v.rows[0].server_version)).toMatch(/^16\./)
    const schemas = await db().query("select schema_name from information_schema.schemata where schema_name in ('app','cms')")
    expect(schemas.rows.map((r) => r.schema_name).sort()).toEqual(['app', 'cms'])
  })

  it('serves the production build', async () => {
    const res = await get('/login')
    expect(res.status).toBe(200)
    expect(BASE()).toMatch(/^http:\/\/127\.0\.0\.1:/)
  })
})
