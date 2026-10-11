import { afterAll, describe, expect, it } from 'vitest'
import { BASE, closeDb, createUser, db, login, uniqueIp, type Session } from '../support/helpers'

afterAll(closeDb)

describe('last active super admin', () => {
  it.each(['staff-role', 'active'])('survives concurrent cross-removal through %s', async (operation) => {
    const stamp = `${Date.now()}-${operation}`
    const existing = (await db().query("select id from app.users where staff_role = 'super_admin' and is_active = true")).rows.map((row) => row.id as string)
    const emailA = `admin-a-${stamp}@race.test`
    const emailB = `admin-b-${stamp}@race.test`
    const a = await createUser({ email: emailA, staffRole: 'super_admin' })
    const b = await createUser({ email: emailB, staffRole: 'super_admin' })
    const sessionA = (await login(emailA))!
    const sessionB = (await login(emailB))!
    const remove = (target: string, session: Session) => fetch(`${BASE()}/api/admin/members/${target}/${operation}`, {
      method: 'POST',
      headers: { cookie: session.cookie, 'content-type': 'application/json', 'x-forwarded-for': uniqueIp() },
      body: JSON.stringify(operation === 'active' ? { isActive: false } : { staffRole: null }),
    })
    try {
      await db().query('update app.users set is_active = false where id = any($1::text[])', [existing])
      const responses = await Promise.all([remove(b, sessionA), remove(a, sessionB)])
      expect(responses.filter((response) => response.ok)).toHaveLength(1)
      const remaining = await db().query("select count(*)::int n from app.users where staff_role = 'super_admin' and is_active = true")
      expect(remaining.rows[0].n).toBe(1)
    } finally {
      await db().query('update app.users set is_active = true where id = any($1::text[])', [existing])
      // Audit actors are intentionally undeletable. Retain these synthetic
      // identities, with no access, until the disposable database is removed.
      await db().query('update app.users set is_active = false, staff_role = null where id = any($1::text[])', [[a, b]])
    }
  })
})
