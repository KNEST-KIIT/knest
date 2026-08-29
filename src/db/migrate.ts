import 'dotenv/config'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client'

/**
 * Drizzle's bookkeeping table lives in its own `drizzle` schema rather than in
 * `app`. If it shared `app`, the migrator would create that schema before
 * running migration 0000, whose own `CREATE SCHEMA "app"` would then fail.
 */
async function main() {
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
