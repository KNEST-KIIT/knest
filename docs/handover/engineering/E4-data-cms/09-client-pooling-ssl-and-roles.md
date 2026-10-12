# E4.09 Database client, pooling, TLS and the runtime role

## 1. The Drizzle client (`src/db/client.ts`)

```
const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl: databaseSsl(process.env) })
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool
export const db = drizzle(pool, { schema })
export { pool }
```

(`client.ts:6-23`.)

- **Driver**: `pg` `Pool` with `drizzle-orm/node-postgres`.
- **Pool size**: `max: 10` per process, hard-coded. No `idleTimeoutMillis`, `connectionTimeoutMillis`
  or `statement_timeout` is set, so node-postgres defaults apply (not determined from this repo; they
  are library defaults). The total connection demand on the database is `10 x (web containers) +
  Payload's own pool`.
- **Hot-reload guard**: in non-production the pool is stashed on `globalThis` so each reload does not
  leak connections (`client.ts:8-11,20`). In production the guard is off; module evaluation happens
  once per process.
- **Second pool**: Payload creates its own pool from the same URL and the same SSL setting
  (`payload.config.ts:101-103`). It is independent of `db`, so a process holds two pools. Payload's
  pool `max` is not set in config: not determined from the code.
- **Timezone and search_path**: neither is set. All `app` SQL schema-qualifies (`app.rate_limits` in
  `rate-limit.ts:60`; `"cms"."staff"` in `auth-strategy.ts:53`), and Drizzle emits `"app"."table"`.
- **Missing `DATABASE_URL`**: `connectionString` becomes `undefined` and `pg` falls back to its
  environment defaults (PG* variables, localhost). In production this is guarded by
  `src/instrumentation.ts` calling `checkProductionEnv` (`instrumentation.ts:3-11`), which refuses to
  start with invalid env. Whether `DATABASE_URL` itself is in the checked schema is not shown in
  the excerpt reviewed.
- **Transactions**: `db.transaction(...)` is used for multi-statement invariants (applications,
  events, labs, members). Row locks used: `SELECT ... FOR UPDATE` (labs, outbox, users), `FOR UPDATE
  SKIP LOCKED` (outbox), `pg_advisory_xact_lock` (event capacity).

## 2. TLS (`src/db/ssl.ts`)

```
DATABASE_SSL = off (default) | verify
verify  -> { ca: <contents of DATABASE_SSL_CA_FILE>, rejectUnauthorized: true }
```

Rules (`ssl.ts:17-29`):

1. Any value other than `off` or `verify` throws `DATABASE_SSL must be off or verify.`. There is
   deliberately no "encrypt without verifying" mode (`ssl.ts:12-15`).
2. In production, if the host in `DATABASE_URL` is not `localhost`, `127.0.0.1`, `[::1]` or
   `postgres`, `DATABASE_SSL` must be `verify`, otherwise it throws (`ssl.ts:21-24`).
3. `verify` without `DATABASE_SSL_CA_FILE` throws (`ssl.ts:26-27`); an unreadable file throws from
   `readFileSync`.
4. The CA file is read at module load; rotating the bundle needs a process restart.

The production environment check repeats the rule for hosted production
(`src/server/env.ts:15-16,48-49,69`). Tests: `src/db/ssl.test.ts` covers all six branches.

Note the asymmetry between the two guards: `ssl.ts` treats the Docker service name `postgres` as
local, whereas `src/db/seed-policy.ts:15` treats `postgres` and `host.docker.internal` as local. See
`10-seeds-and-production-refusal.md`.

## 3. Separating the migration identity from the runtime identity (`src/db/runtime-role.ts`)

Purpose (`runtime-role.ts:5-17`): the migration job connects as the database owner (on AWS, the RDS
master user) and, as its last step, creates or updates one login role that may read and write rows in
`app` and `cms` and nothing else. The web container is then started with that role's credentials, so
a flaw in the application cannot rewrite the schema.

Invocation: third command of `pnpm migrate` (`package.json:20`), and the `migrate` Docker target
(`Dockerfile:40-42`). Disabled when `DB_RUNTIME_USER` is unset: it logs "skipped (single database
identity)" and returns (`runtime-role.ts:66-69`). Local development and CI therefore run as one user.

Inputs: `DB_RUNTIME_USER` (3 to 31 chars of `[a-z0-9_]`, starting with a letter or underscore, not
`pg_*`, `postgres`, `rds_superuser`; `runtime-role.ts:20-26`), `DB_RUNTIME_PASSWORD` (at least 24
characters; line 72), `DATABASE_URL`, optional `DATABASE_SSL`/`DATABASE_SSL_CA_FILE` (same `verify`
semantics, duplicated in `runtime-role.ts:58-62`).

Procedure, inside one transaction (`runtime-role.ts:82-92`):

1. Read `current_user` and `current_database()`; refuse if the current user equals the runtime role.
2. `CREATE ROLE` or `ALTER ROLE ... WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
   NOINHERIT PASSWORD <literal>`, the statement built with `format('%I', '%L')` so the password is
   quoted by the server (`runtime-role.ts:86-90`).
3. Statements from `privilegeStatements` (`runtime-role.ts:34-56`):

| Statement | Effect |
|---|---|
| `REVOKE ALL ON DATABASE <db> FROM <role>`; `GRANT CONNECT ON DATABASE <db> TO <role>` | connect only |
| for each of `app`, `cms`: `GRANT USAGE ON SCHEMA` | can name objects |
| `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA` | row access to existing tables |
| `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA` | `serial` ids in `cms` |
| `ALTER DEFAULT PRIVILEGES FOR ROLE <owner> IN SCHEMA ... GRANT ... ON TABLES / SEQUENCES` | the same grants for tables the owner creates in later releases |
| `REVOKE ALL ON SCHEMA "drizzle" FROM <role>` | bookkeeping stays with the owner |

Consequences to know:

- **No `CREATE` on schema, no `TRUNCATE`, no `DROP`/`ALTER`, no `CREATE EXTENSION`.** The unit test
  forbids those words in the generated SQL (`runtime-role.test.ts:14-20`).
- **`btree_gist` and the exclusion constraint** are created by the owner in migration 0010, so the
  runtime role never needs extension rights.
- **Payload at runtime** must therefore not try to alter the schema. That is consistent with
  `push: false`. If Payload were started with `push: true` under this role it would fail.
- **Enum additions and new tables** appear to the runtime role only because of default privileges:
  they apply to objects created by `<owner>`; objects created by any other role are not covered.
- **Roles are cluster-wide**: the role and password persist across databases in the cluster; the
  script re-applies privileges only for the connected database.
- The script does not `REVOKE` privileges on tables dropped or on schemas other than the three named.
  Default `PUBLIC` privileges on the `public` schema are not changed here (not determined whether any
  application object lives in `public`; none was found).

Failure behaviour: any error rolls back and exits non-zero (`runtime-role.ts:94-97,102-107`), failing
the migrate job so the release does not proceed with a half-configured role.

## 4. Operational checklist derived from the above

1. Set `DATABASE_URL` (owner) for the migrate job and the runtime user's URL for the web container;
   they differ only in credentials.
2. Provide the CA bundle file inside both images (`DATABASE_SSL_CA_FILE`).
3. Confirm after a release that `\dp app.*` shows the runtime role with `arwd` only.
4. Pool arithmetic: two pools of up to 10 per web process (Drizzle) plus Payload's pool; compare with
   the instance class's `max_connections`. Neither value is in this repository.
