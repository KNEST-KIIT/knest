// Populated-data upgrade drill. Starts a throwaway PostgreSQL 16, applies every Drizzle migration
// except the last N (the "previous release"), inserts representative rows, then applies the full
// set (the "new release") and checks that every row survived and the new objects exist.
//
//   pnpm exec tsx scripts/drills/populated-upgrade.mts [lastN=1]
//
// Evidence is the printed table; paste it into docs/delivery/DRILLS.md with the date and SHA.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { startTestDatabase } from '../../tests/support/pg'

const lastN = Number(process.argv[2] ?? 1)
const source = path.resolve(import.meta.dirname, '../../src/db/migrations')
const journal = JSON.parse(readFileSync(path.join(source, 'meta/_journal.json'), 'utf8')) as { entries: unknown[] }
const total = journal.entries.length

const previous = mkdtempSync(path.join(os.tmpdir(), 'knest-prev-'))
cpSync(source, previous, { recursive: true })
writeFileSync(path.join(previous, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, total - lastN) }, null, 2))

const database = await startTestDatabase()
const pool = new pg.Pool({ connectionString: database.url })
const run = async (folder: string) => migrate(drizzle(pool), { migrationsFolder: folder, migrationsSchema: 'drizzle' })
const count = async (table: string) => Number((await pool.query(`select count(*)::int c from ${table}`)).rows[0].c)
const rows: [string, string, string][] = []
try {
  await run(previous)
  const applied = (await pool.query('select count(*)::int c from drizzle.__drizzle_migrations')).rows[0].c
  rows.push(['previous release applied', `${applied} of ${total} migrations`, 'ok'])

  const hash = '$2b$12$' + 'x'.repeat(53)
  for (let i = 0; i < 200; i++) {
    await pool.query(
      `insert into app.users (id, email, name, password_hash, platform_role, email_verified) values ($1, $2, $3, $4, 'student', now())`,
      [`drill-u-${i}`, `drill-${i}@example.test`, `Drill ${i}`, hash],
    )
  }
  for (let i = 0; i < 50; i++) {
    await pool.query(`insert into app.enquiries (id, name, email, message) values ($1, 'Drill', $2, 'Seeded before the upgrade')`, [`drill-e-${i}`, `drill-${i}@example.test`])
  }
  const before = { users: await count('app.users'), enquiries: await count('app.enquiries') }
  rows.push(['rows seeded before upgrade', `users=${before.users} enquiries=${before.enquiries}`, 'ok'])

  await run(source)
  const after = { users: await count('app.users'), enquiries: await count('app.enquiries') }
  rows.push(['rows after upgrade', `users=${after.users} enquiries=${after.enquiries}`, after.users === before.users && after.enquiries === before.enquiries ? 'ok' : 'FAIL'])
  const newest = (await pool.query('select count(*)::int c from drizzle.__drizzle_migrations')).rows[0].c
  rows.push(['new release applied', `${newest} of ${total} migrations`, newest === total ? 'ok' : 'FAIL'])

  const sample = await pool.query(`select email, password_hash from app.users where id = 'drill-u-7'`)
  rows.push(['sample row intact', sample.rows[0]?.email ?? 'missing', sample.rows[0]?.password_hash === hash ? 'ok' : 'FAIL'])

  const again = await run(source).then(() => 'ok', (e) => `FAIL ${(e as Error).message}`)
  rows.push(['migrating again is a no-op', '', again])
} finally {
  await pool.end()
  await database.stop()
  rmSync(previous, { recursive: true, force: true })
}
console.log('\n| Step | Detail | Result |\n|---|---|---|')
for (const [a, b, c] of rows) console.log(`| ${a} | ${b} | ${c} |`)
process.exit(rows.some((r) => r[2].startsWith('FAIL')) ? 1 : 0)
