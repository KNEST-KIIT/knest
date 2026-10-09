import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { databaseSsl } from './ssl'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { pool?: Pool }

/**
 * A single pool is reused across hot reloads in dev; without this, every reload
 * leaks connections until Postgres refuses new ones.
 */
const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: databaseSsl(process.env),
  })

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })
export { pool }
