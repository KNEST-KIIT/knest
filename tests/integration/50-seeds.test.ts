import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { closeDb, db } from '../support/helpers'
import { payloadClient } from '../support/payload'

/**
 * Closing evidence for KN-07, against a real database: the seed never rewrites
 * an existing account, refuses unsafe settings, and never overwrites homepage
 * copy a staff editor wrote.
 */

const ROOT = path.resolve(import.meta.dirname, '../..')
afterAll(closeDb)

function seed(env: Record<string, string | undefined>) {
  const clean: NodeJS.ProcessEnv = { ...process.env }
  for (const k of ['NODE_ENV', 'SEED_PASSWORD', 'SEED_RESET_EXISTING', 'SEED_ADMIN_EMAIL', 'APP_ENV', 'VERCEL_ENV']) delete clean[k]
  const r = spawnSync('npx', ['tsx', 'src/db/seed.ts'], {
    cwd: ROOT,
    env: { ...clean, ...env } as NodeJS.ProcessEnv,
    encoding: 'utf8',
    shell: true,
    input: '',
    timeout: 240_000,
  })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` }
}

const hashOf = async (email: string) =>
  (await db().query('select password_hash h from app.users where email = $1', [email])).rows[0]?.h as string | undefined

const ADMIN = 'seeded-admin@seed.test'

describe('db:seed (KN-07)', () => {
  it('against a local database the published default password is allowed, and the admin is created', async () => {
    const r = seed({ SEED_ADMIN_EMAIL: ADMIN })
    expect(r.status, r.out.slice(-800)).toBe(0)
    expect(await hashOf(ADMIN)).toBeTruthy()
    const row = (await db().query('select staff_role from app.users where email = $1', [ADMIN])).rows[0]
    expect(row.staff_role).toBe('super_admin')
  })

  it('a re-run with a different password does NOT overwrite the existing admin', async () => {
    const before = await hashOf(ADMIN)
    const r = seed({ SEED_ADMIN_EMAIL: ADMIN, SEED_PASSWORD: 'a-completely-different-password-1' })
    expect(r.status, r.out.slice(-800)).toBe(0)
    expect(await hashOf(ADMIN)).toBe(before)
  })

  it('never overwrites homepage copy that a staff editor has written', async () => {
    const payload = await payloadClient()
    await payload.updateGlobal({ slug: 'homepage', data: { heroHeadline: 'WRITTEN BY STAFF' }, overrideAccess: true })
    const r = seed({ SEED_ADMIN_EMAIL: ADMIN })
    expect(r.status, r.out.slice(-800)).toBe(0)
    const home = await payload.findGlobal({ slug: 'homepage', overrideAccess: true })
    expect(home.heroHeadline).toBe('WRITTEN BY STAFF')
  })

  it('SEED_RESET_EXISTING=true is the only way to change an existing account', async () => {
    const before = await hashOf(ADMIN)
    const r = seed({ SEED_ADMIN_EMAIL: ADMIN, SEED_PASSWORD: 'a-completely-different-password-1', SEED_RESET_EXISTING: 'true' })
    expect(r.status, r.out.slice(-800)).toBe(0)
    expect(await hashOf(ADMIN)).not.toBe(before)
  })

  it('refuses production without an explicit password, and creates nothing', async () => {
    const email = 'prod-attempt@seed.test'
    const r = seed({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: email })
    expect(r.status).not.toBe(0)
    expect(r.out).toMatch(/Refusing to seed with the default password/)
    expect(await hashOf(email)).toBeUndefined()
  })

  it('refuses the published default as an explicit password', async () => {
    const email = 'default-explicit@seed.test'
    const r = seed({ SEED_ADMIN_EMAIL: email, SEED_PASSWORD: 'knest-dev-password' })
    expect(r.status).not.toBe(0)
    expect(await hashOf(email)).toBeUndefined()
  })

  it('creates the non-staff test account outside production only', async () => {
    const row = (await db().query("select staff_role from app.users where email = 'student@knest.local'")).rows[0]
    expect(row).toBeTruthy()
    expect(row.staff_role).toBeNull()
  })
})
