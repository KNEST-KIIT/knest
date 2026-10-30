import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

/**
 * Separates the database identity that CHANGES the schema from the one that RUNS the site.
 *
 * The migration job connects as the database owner (DATABASE_URL: on AWS, the RDS master user)
 * and, as its last step, calls this script. It creates or updates one login role that may read
 * and write rows in `app` and `cms` and nothing else: no CREATE, no DROP or ALTER, no
 * TRUNCATE, no role management, no new extensions. The web container is started with that
 * role's credentials, so a flaw in the application can no longer rewrite the schema or read the
 * master secret (which the instance role may no longer read either; see app.yaml).
 *
 * Idempotent. With DB_RUNTIME_USER unset it does nothing, so local development and CI keep
 * running as the single database user.
 */

const SCHEMAS = ['app', 'cms'] as const
const ROLE_PATTERN = /^[a-z_][a-z0-9_]{2,30}$/

export function assertRoleName(name: string): string {
  if (!ROLE_PATTERN.test(name)) throw new Error('DB_RUNTIME_USER must be 3 to 31 characters of a-z, 0-9 and underscore, starting with a letter or underscore.')
  if (name.startsWith('pg_') || name === 'postgres' || name === 'rds_superuser') throw new Error('DB_RUNTIME_USER names a reserved role.')
  return name
}

const ident = (value: string) => `"${value.replace(/"/g, '""')}"`

/**
 * The privilege statements, in order. Pure so it can be tested without a database.
 * `owner` is the migration role whose future tables must be readable by the runtime role.
 */
export function privilegeStatements(role: string, owner: string, database: string): string[] {
  const r = ident(assertRoleName(role))
  const o = ident(owner)
  const statements = [
    // Nothing is inherited from PUBLIC beyond what is revoked here.
    `REVOKE ALL ON DATABASE ${ident(database)} FROM ${r}`,
    `GRANT CONNECT ON DATABASE ${ident(database)} TO ${r}`,
  ]
  for (const schema of SCHEMAS) {
    const s = ident(schema)
    statements.push(
      `GRANT USAGE ON SCHEMA ${s} TO ${r}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${s} TO ${r}`,
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${s} TO ${r}`,
      // Tables the migration role creates later (the next release) get the same grants.
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${o} IN SCHEMA ${s} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${r}`,
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${o} IN SCHEMA ${s} GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${r}`,
    )
  }
  // The Drizzle bookkeeping schema stays with the migration role.
  statements.push(`REVOKE ALL ON SCHEMA "drizzle" FROM ${r}`)
  return statements
}

function ssl(env: NodeJS.ProcessEnv) {
  if (env.DATABASE_SSL !== 'verify') return false
  if (!env.DATABASE_SSL_CA_FILE) throw new Error('DATABASE_SSL=verify needs DATABASE_SSL_CA_FILE.')
  return { ca: readFileSync(env.DATABASE_SSL_CA_FILE, 'utf8'), rejectUnauthorized: true as const }
}

async function passwordMatches(user: string, pass: string, databaseUrl: string, sslOpts: ReturnType<typeof ssl>): Promise<boolean> {
  try {
    const url = new URL(databaseUrl)
    url.username = user
    url.password = pass
    const probe = new Client({ connectionString: url.toString(), ssl: sslOpts })
    await probe.connect()
    await probe.end()
    return true
  } catch {
    return false
  }
}

async function main() {
  const role = process.env.DB_RUNTIME_USER
  if (!role) {
    console.log('runtime role: DB_RUNTIME_USER not set, skipped (single database identity)')
    return
  }
  assertRoleName(role)
  const password = process.env.DB_RUNTIME_PASSWORD
  if (!password || password.length < 24) throw new Error('DB_RUNTIME_PASSWORD must be set and at least 24 characters.')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.')

  const sslOpts = ssl(process.env)
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: sslOpts })
  await client.connect()
  try {
    const who = await client.query<{ owner: string; db: string }>('select current_user as owner, current_database() as db')
    const { owner, db } = who.rows[0]!
    if (owner === role) throw new Error('The migration identity and the runtime identity must be different roles.')

    await client.query('BEGIN')
    // The password is bound as a parameter of format(); it never appears in a statement log line built here.
    const exists = await client.query('select 1 from pg_roles where rolname = $1', [role])
    if (!exists.rowCount) {
      // In PG16 on Amazon RDS, non-superusers (even rds_superuser) cannot specify SUPERUSER or REPLICATION.
      // Omit those attributes so CREATE succeeds cleanly without requiring true superuser.
      const text = await client.query<{ s: string }>(
        `select format('CREATE ROLE %I WITH LOGIN NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', $1::text, $2::text) as s`,
        [role, password],
      )
      await client.query(text.rows[0]!.s)
      await client.query(`GRANT ${ident(role)} TO ${ident(owner)} WITH ADMIN OPTION`).catch(() => undefined)
    } else {
      // If the runtime role already authenticates with this password, skip ALTER ROLE.
      const matches = await passwordMatches(role, password, process.env.DATABASE_URL, sslOpts)
      if (matches) {
        console.log(`runtime role: password already matches for ${role}; skipping ALTER ROLE`)
      } else {
        // Role exists and password needs update: ensure owner has ADMIN OPTION on PG16
        await client.query(`GRANT ${ident(role)} TO ${ident(owner)} WITH ADMIN OPTION`).catch(() => undefined)
        // Alter only the password; omit restricted attributes like NOSUPERUSER/NOREPLICATION on PG16.
        // If this fails, let the error throw so migration aborts rather than deploying unauthenticated container.
        const text = await client.query<{ s: string }>(
          `select format('ALTER ROLE %I WITH PASSWORD %L', $1::text, $2::text) as s`,
          [role, password],
        )
        await client.query(text.rows[0]!.s)
      }
    }
    for (const statement of privilegeStatements(role, owner, db)) await client.query(statement)
    await client.query('COMMIT')
    console.log(`runtime role: ${role} ${exists.rowCount ? 'updated' : 'created'}; owner ${owner}; privileges applied`)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

if (process.argv[1] && /runtime-role\.(ts|js)$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error('runtime role failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
