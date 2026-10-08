import { mkdtempSync, rmSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

/**
 * Ephemeral PostgreSQL for integration tests.
 *
 * - In CI, a Postgres service container is used: set TEST_DATABASE_URL.
 * - Locally, a real Postgres 16 (the RDS major version) is started from the
 *   embedded-postgres package in a temp directory on a free loopback port and
 *   deleted afterwards. No Docker is needed.
 *
 * Either way the database name must end in `_test` and the host must be
 * loopback or a CI service name, so a mis-set variable can never aim the tests
 * (which create and drop rows and schemas) at a real database.
 */

const SAFE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'])

export function assertSafeTestDatabase(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL')
  }
  const name = parsed.pathname.replace(/^\//, '')
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run integration tests: database "${name}" does not end in "_test".`)
  }
  if (!SAFE_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Refusing to run integration tests against host "${parsed.hostname}" (loopback or CI service only).`)
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo
      server.close(() => resolve(port))
    })
  })
}

export type TestDatabase = { url: string; stop: () => Promise<void> }

export async function startTestDatabase(): Promise<TestDatabase> {
  const provided = process.env.TEST_DATABASE_URL
  if (provided) {
    assertSafeTestDatabase(provided)
    return { url: provided, stop: async () => {} }
  }

  const { default: EmbeddedPostgres } = await import('embedded-postgres')
  const dir = mkdtempSync(path.join(os.tmpdir(), 'knest-pg-'))
  const port = await freePort()
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'knest',
    password: 'knest-test-only',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('knest_test')
  const url = `postgres://knest:knest-test-only@127.0.0.1:${port}/knest_test`
  assertSafeTestDatabase(url)
  return {
    url,
    stop: async () => {
      await pg.stop().catch(() => {})
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
