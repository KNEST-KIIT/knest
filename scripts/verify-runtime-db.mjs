import assert from 'node:assert/strict'
import { Client } from 'pg'

// CI-only: never aim this probe at a hosted database, even accidentally.
const url = new URL(process.env.DATABASE_URL)
assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'loopback database required')
assert(url.pathname.endsWith('_test'), 'disposable _test database required')
assert.equal(url.username, 'knest_app')
const client = new Client({ connectionString: url.toString(), ssl: false })
await client.connect()
try {
  const { rows: [role] } = await client.query(`
    SELECT current_user AS name, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
      has_database_privilege(current_database(), 'CREATE') AS create_schema
    FROM pg_roles WHERE rolname = current_user
  `)
  assert.equal(role.name, 'knest_app')
  for (const key of ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolbypassrls', 'create_schema']) {
    assert.equal(role[key], false, `runtime must lack ${key}`)
  }
  const { rows: [publicSchema] } = await client.query("SELECT has_schema_privilege('public', 'CREATE') AS allowed")
  assert.equal(publicSchema.allowed, false, 'runtime must not create tables in public')
  for (const schema of ['app', 'cms']) {
    const { rows: [rights] } = await client.query(`
      SELECT has_schema_privilege($1, 'USAGE') AS usage,
        has_schema_privilege($1, 'CREATE') AS create_table
    `, [schema])
    assert.equal(rights.usage, true)
    assert.equal(rights.create_table, false)
    const { rows } = await client.query(`
      SELECT c.oid, c.relname, pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('r', 'p')
    `, [schema])
    assert(rows.length > 0, `${schema} must contain migrated tables`)
    for (const table of rows) {
      assert.notEqual(table.owner, role.name, `${schema}.${table.relname}: runtime owns table`)
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        const { rows: [result] } = await client.query(
          'SELECT has_table_privilege($1::oid, $2) AS allowed', [table.oid, privilege],
        )
        assert.equal(result.allowed, privilege !== 'TRUNCATE', `${schema}.${table.relname}: ${privilege}`)
      }
    }
  }
  const { rows: [drizzle] } = await client.query("SELECT has_schema_privilege('drizzle', 'USAGE') AS allowed")
  assert.equal(drizzle.allowed, false)
  console.log('PASS: migrated image runtime has row access without schema ownership or DDL grants')
} finally {
  await client.end()
}
