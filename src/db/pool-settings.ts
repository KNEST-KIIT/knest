type Env = { [name: string]: string | undefined }

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/**
 * Connection pool limits shared by the application pool (src/db/client.ts) and the CMS pool
 * (src/payload/payload.config.ts), so both fail fast the same way.
 *
 *  - connectionTimeoutMillis: how long a request waits for a free connection before it errors.
 *  - statement_timeout / query_timeout: a runaway query is cancelled instead of holding a connection.
 *    DB_STATEMENT_TIMEOUT_MS=0 turns them off (the migration job does, since an index build can be slow).
 *  - idleTimeoutMillis: idle connections are returned before a managed database drops them silently.
 *  - keepAlive: detects a dead peer after a failover.
 */
export function poolSettings(env: Env = process.env) {
  const base = {
    max: positive(env.DB_POOL_MAX, 10),
    connectionTimeoutMillis: positive(env.DB_CONNECT_TIMEOUT_MS, 5_000),
    idleTimeoutMillis: positive(env.DB_IDLE_TIMEOUT_MS, 30_000),
    keepAlive: true,
  }
  if (env.DB_STATEMENT_TIMEOUT_MS === '0') return base
  const statementMs = positive(env.DB_STATEMENT_TIMEOUT_MS, 15_000)
  return { ...base, statement_timeout: statementMs, query_timeout: statementMs + 2_000 }
}
