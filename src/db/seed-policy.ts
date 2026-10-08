/**
 * Guards for the seed scripts (KN-07).
 *
 * `tsx` scripts do not get NODE_ENV=production just because the target database
 * is production, so "is this production?" cannot rest on NODE_ENV alone. These
 * helpers judge the environment from several signals and from where the database
 * actually is.
 */

type Env = Record<string, string | undefined>

const DEV_PASSWORD = 'knest-dev-password'
const MIN_PASSWORD_LENGTH = 12

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'host.docker.internal'])

export function databaseHost(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isLocalDatabase(env: Env): boolean {
  const host = databaseHost(env.DATABASE_URL)
  return host !== null && LOCAL_HOSTS.has(host)
}

/** True when any signal says this is production, regardless of the database. */
export function looksLikeProduction(env: Env): boolean {
  return (
    env.NODE_ENV === 'production' ||
    env.APP_ENV === 'production' ||
    env.VERCEL_ENV === 'production'
  )
}

/**
 * The password for the seeded super admin.
 *
 * The published development default is allowed only against a local database
 * outside production. Anywhere else an explicit, long SEED_PASSWORD is required.
 */
export function resolveSeedPassword(env: Env): string {
  const explicit = env.SEED_PASSWORD
  if (explicit !== undefined && explicit !== '') {
    if (explicit === DEV_PASSWORD) {
      throw new Error('SEED_PASSWORD must not be the published development default.')
    }
    if (explicit.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`SEED_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    }
    return explicit
  }
  if (looksLikeProduction(env) || !isLocalDatabase(env)) {
    throw new Error(
      'Refusing to seed with the default password: set SEED_PASSWORD (min 12 chars). ' +
        'The default is only allowed against a local database outside production.',
    )
  }
  return DEV_PASSWORD
}

/**
 * Demo and dummy seeds insert fictional records and well-known logins. They never
 * run in production, and only run against a non-local database when explicitly
 * allowed (e.g. a disposable staging database).
 */
export function assertDemoSeedAllowed(env: Env, script: string): void {
  if (looksLikeProduction(env)) {
    throw new Error(`${script} refuses to run in production (NODE_ENV/APP_ENV/VERCEL_ENV).`)
  }
  if (!isLocalDatabase(env) && env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      `${script} refuses to run against a non-local database. ` +
        'Set ALLOW_DEMO_SEED=true only for a disposable non-production database.',
    )
  }
}

/** Seeds create accounts; they must never silently rewrite an existing one. */
export function mayModifyExistingUsers(env: Env): boolean {
  return env.SEED_RESET_EXISTING === 'true' && !looksLikeProduction(env)
}
