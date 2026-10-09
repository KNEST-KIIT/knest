import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CAPTCHA, BASE, closeDb, createUser, db, get, login, readMail, uniqueIp, type Session } from '../support/helpers'
import { payloadClient, richText } from '../support/payload'

/**
 * Regression pass over the upgraded stack (Payload 3.90, Next 16.4, nodemailer
 * 10, sharp 0.35.5) and over the migration path, on a real database and the
 * production build.
 */

const ROOT = path.resolve(import.meta.dirname, '../..')
afterAll(closeDb)

describe('nodemailer 10', () => {
  it('delivers a message over SMTP with the configured sender', async () => {
    process.env.SMTP_HOST = '127.0.0.1'
    process.env.SMTP_PORT = process.env.TEST_SMTP_PORT ?? '0'
    process.env.EMAIL_FROM = 'KNEST Tests <no-reply@knest.test>'
    const { sendEmail } = await import('@/server/email/send')
    const to = `direct-${Date.now()}@mail.test`
    await sendEmail({ to, subject: 'Regression check', text: 'hello from the integration suite' })
    const mail = readMail().find((m) => m.to.includes(to))
    expect(mail).toBeTruthy()
    expect(mail!.body).toContain('Regression check')
    expect(mail!.body).toContain('no-reply@knest.test')
  })
})

describe('migrations (KN-04)', () => {
  it('the committed Payload migrations describe the current collections: no schema drift', () => {
    const dir = path.join(ROOT, 'src', 'migrations')
    const before = new Set(readdirSync(dir))
    const r = spawnSync('npx', ['payload', 'migrate:create', 'drift_check', '--skip-empty'], {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'development' },
      encoding: 'utf8',
      shell: true,
      input: '',
      timeout: 240_000,
    })
    const created = readdirSync(dir).filter((f) => !before.has(f))
    for (const f of created) rmSync(path.join(dir, f), { force: true })
    expect(created, `A collection changed without a migration. Run: pnpm payload migrate:create <name>\n${r.stdout.slice(-600)}`).toEqual([])
  })

  it('both schemas exist and every Drizzle migration was recorded', async () => {
    const applied = await db().query('select count(*)::int c from drizzle.__drizzle_migrations')
    const files = readdirSync(path.join(ROOT, 'src', 'db', 'migrations')).filter((f) => f.endsWith('.sql'))
    expect(applied.rows[0].c).toBe(files.length)
    const payloadApplied = await db().query('select count(*)::int c from cms.payload_migrations')
    expect(payloadApplied.rows[0].c).toBeGreaterThanOrEqual(1)
  })

  it('re-running both migrators on an up-to-date database is a no-op', () => {
    for (const args of [['tsx', 'src/db/migrate.ts'], ['payload', 'migrate']]) {
      const r = spawnSync('npx', args, {
        cwd: ROOT,
        env: { ...process.env, NODE_ENV: 'production' },
        encoding: 'utf8',
        shell: true,
        input: '',
        timeout: 240_000,
      })
      expect(r.status, `${args.join(' ')}: ${r.stdout.slice(-300)}${r.stderr.slice(-300)}`).toBe(0)
    }
  })

  // NF-04: the lab_admin role existed in code and in Payload's access rules but not in the
  // app.staff_role enum, because no Drizzle migration added it (0006_lab_admin_role).
  it('NF-04: the lab_admin staff role can be stored (enum migration 0006)', async () => {
    const id = await createUser({ email: 'lab-admin@enum.test', platformRole: 'other', staffRole: 'lab_admin' })
    const row = await db().query('select staff_role from app.users where id = $1', [id])
    expect(row.rows[0].staff_role).toBe('lab_admin')
  })
})

describe('core loop on the upgraded stack (partial golden path)', () => {
  let program: Session
  let reviewer: Session
  let student: Session
  let applicationId = ''
  const slug = `regression-program-${Date.now()}`

  beforeAll(async () => {
    await createUser({ email: 'pm@core.test', platformRole: 'other', staffRole: 'program_manager' })
    await createUser({ email: 'rev@core.test', platformRole: 'other', staffRole: 'reviewer' })
    await createUser({ email: 'stu@core.test', platformRole: 'student' })
    program = (await login('pm@core.test'))!
    reviewer = (await login('rev@core.test'))!
    student = (await login('stu@core.test'))!
  })

  const json = (session: Session, body: unknown, method = 'POST') => ({
    method,
    headers: { 'content-type': 'application/json', cookie: session.cookie, 'x-forwarded-for': uniqueIp() },
    body: JSON.stringify(body),
  })

  it('a reviewer cannot create a program; a program manager can, and can publish it', async () => {
    const data = {
      title: 'Regression Program',
      slug,
      tagline: 'Created over REST by a program manager',
      whoItsFor: richText('Everyone'),
      stage: ['idea'],
      applicationStatus: 'open',
      _status: 'published',
    }
    const denied = await fetch(`${BASE()}/api/programs`, json(reviewer, data))
    expect([401, 403]).toContain(denied.status)

    const ok = await fetch(`${BASE()}/api/programs`, json(program, data))
    expect(ok.status, (await ok.text()).slice(0, 300)).toBe(201)

    const page = await (await get('/programs')).text()
    expect(page).toContain('Regression Program')
  })

  it('a student can start an application (draft), and starting twice is idempotent', async () => {
    const a = await fetch(`${BASE()}/api/applications/start`, json(student, { programSlug: slug }))
    const first = await a.json()
    expect(a.status, JSON.stringify(first)).toBe(200)
    applicationId = first.applicationId
    const b = await fetch(`${BASE()}/api/applications/start`, json(student, { programSlug: slug }))
    expect((await b.json()).applicationId).toBe(applicationId)
    const rows = await db().query('select status from app.applications where id = $1', [applicationId])
    expect(rows.rows[0].status).toBe('draft')
  })

  it('submitting moves it to "submitted" exactly once', async () => {
    const first = await fetch(`${BASE()}/api/applications/${applicationId}/submit`, json(student, CAPTCHA))
    expect(first.status, (await first.text()).slice(0, 300)).toBe(200)
    const again = await fetch(`${BASE()}/api/applications/${applicationId}/submit`, json(student, CAPTCHA))
    expect(again.status).toBeGreaterThanOrEqual(400)
    const rows = await db().query('select status from app.applications where id = $1', [applicationId])
    expect(rows.rows[0].status).toBe('submitted')
  })

  it('a reviewer can move it forward and the change is audited; a student cannot', async () => {
    const forbidden = await fetch(`${BASE()}/api/admin/applications/${applicationId}/status`, json(student, { status: 'accepted' }))
    expect([401, 403, 404]).toContain(forbidden.status)

    const ok = await fetch(`${BASE()}/api/admin/applications/${applicationId}/status`, json(reviewer, { status: 'under_review', note: 'looks good' }))
    expect(ok.status, (await ok.text()).slice(0, 300)).toBe(200)

    const app = await db().query('select status from app.applications where id = $1', [applicationId])
    expect(app.rows[0].status).toBe('under_review')
    const audit = await db().query("select count(*)::int c from app.audit_logs where action = 'application_status_changed'")
    expect(audit.rows[0].c).toBeGreaterThanOrEqual(1)
    const note = await db().query('select count(*)::int c from app.notifications n join app.users u on u.id = n.user_id where u.email = $1', ['stu@core.test'])
    expect(note.rows[0].c).toBeGreaterThanOrEqual(1)
  })

  it('an illegal transition is refused', async () => {
    const res = await fetch(`${BASE()}/api/admin/applications/${applicationId}/status`, json(reviewer, { status: 'accepted' }))
    expect(res.status).toBe(400)
  })

  it('local media directory was not written into the repository', () => {
    expect(existsSync(path.join(ROOT, 'media'))).toBe(false)
  })

  it('payload local API still works in-process', async () => {
    const payload = await payloadClient()
    const r = await payload.find({ collection: 'programs', where: { slug: { equals: slug } }, overrideAccess: true })
    expect(r.totalDocs).toBe(1)
  })
})
