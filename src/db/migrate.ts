import 'dotenv/config'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

// A schema change (an index build, a backfill) can legitimately run longer than the request-path
// statement timeout, so the migration job opens its pool without one. Set before the client loads.
process.env.DB_STATEMENT_TIMEOUT_MS = '0'

/**
 * Drizzle's bookkeeping table lives in its own `drizzle` schema rather than in
 * `app`. If it shared `app`, the migrator would create that schema before
 * running migration 0000, whose own `CREATE SCHEMA "app"` would then fail.
 */
async function main() {
  const { db, pool } = await import('./client')
  await migrate(db, {
    migrationsFolder: './src/db/migrations',
    migrationsSchema: 'drizzle',
  })
  console.log('✓ migrations applied')
  await pool.end()
}

main().catch((error) => {
  console.error('✗ migration failed:', error)
  process.exit(1)
})
