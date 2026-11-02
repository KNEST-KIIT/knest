import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { databaseSsl } from './ssl'
import * as schema from './schema'
import { poolSettings } from './pool-settings'

const globalForDb = globalThis as unknown as { pool?: Pool }

/**
 * A single pool is reused across hot reloads in dev; without this, every reload
 * leaks connections until Postgres refuses new ones.
 *
 * The timeouts matter more than the size: without them a saturated or failing
 * database leaves requests waiting forever instead of failing fast.
 */
function createPool(): Pool {
  const created = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: databaseSsl(process.env),
    ...poolSettings(process.env),
  })
  // An idle client that loses its connection (a database restart or failover) emits 'error' on the
  // pool. With no listener Node treats that as an uncaught exception and the whole process exits.
  created.on('error', (error) => {
    console.error('[db] idle client error; the pool will replace the connection', error.message)
  })
  return created
}

const pool = globalForDb.pool ?? createPool()

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })
export { pool }
