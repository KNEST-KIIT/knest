# KN-07: seed scripts under unsafe settings
HEAD a1ff0b9. No database connection is made: each script throws before any DB work.

```
$ DATABASE_URL=<remote host> npx tsx src/db/seed.ts        (NODE_ENV unset, as with tsx)
✗ seed failed: Error: Refusing to seed with the default password: set SEED_PASSWORD (min 12 chars). The default is only allowed against a local database outside production.
exit 1

$ NODE_ENV=production DATABASE_URL=<127.0.0.1> npx tsx src/db/seed.ts
✗ seed failed: Error: Refusing to seed with the default password: set SEED_PASSWORD (min 12 chars). The default is only allowed against a local database outside production.
exit 1

$ NODE_ENV=production SEED_PASSWORD=<long> npx tsx src/db/seed-demo.ts
✗ demo seed failed: Error: seed-demo refuses to run in production (NODE_ENV/APP_ENV/VERCEL_ENV).
exit 1

$ DATABASE_URL=<remote host> npx tsx src/db/seed-dummy-runner.ts
Error: seed-dummy-runner refuses to run against a non-local database. Set ALLOW_DEMO_SEED=true only for a disposable non-production database.
exit 1
```
