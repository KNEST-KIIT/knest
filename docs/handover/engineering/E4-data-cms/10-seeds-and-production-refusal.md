# E4.10 Seeds and the production refusal policy

Files: `src/db/seed.ts`, `seed-cms.ts`, `seed-demo.ts`, `seed-dummy.ts`, `seed-dummy-runner.ts`,
`seed-policy.ts`, tests `seed-policy.test.ts` and `tests/integration/50-seeds.test.ts`.
npm scripts: `db:seed` -> `tsx src/db/seed.ts`, `db:seed:demo` -> `tsx src/db/seed-demo.ts`
(`package.json:21-22`). `seed-dummy-runner.ts` has no script entry in the lines reviewed; it is run
directly with `tsx`.

## 1. Why a policy module exists (KN-07)

`tsx` scripts do not receive `NODE_ENV=production` merely because the target database is production
(`seed-policy.ts:1-8`). "Is this production?" therefore cannot rest on `NODE_ENV`. The policy judges
from several signals and from where the database actually is.

| Function (`seed-policy.ts`) | Rule |
|---|---|
| `databaseHost(url)` (17-24) | lower-cased hostname of `DATABASE_URL`, `null` if missing or unparsable |
| `isLocalDatabase(env)` (26-29) | host is one of `localhost`, `127.0.0.1`, `::1`, `[::1]`, `postgres`, `host.docker.internal`. `localhost.evil.com` is not local (test) |
| `looksLikeProduction(env)` (32-38) | `NODE_ENV`, `APP_ENV` or `VERCEL_ENV` equals `production` |
| `resolveSeedPassword(env)` (46-64) | explicit `SEED_PASSWORD` must be at least 12 chars and not the published default `knest-dev-password`; with none, the default is returned only if not production and the DB is local, otherwise throws "Refusing to seed with the default password" |
| `assertDemoSeedAllowed(env, script)` (71-81) | throws in production regardless of opt-in; throws against a non-local DB unless `ALLOW_DEMO_SEED=true` |
| `mayModifyExistingUsers(env)` (84-86) | `SEED_RESET_EXISTING=true` and not production |

## 2. The three seeds

| Script | Intended environment | Guard | What it writes |
|---|---|---|---|
| `seed.ts` (`db:seed`) | the only seed meant for production | `resolveSeedPassword` before any DB work (`seed.ts:154`) | super admin (`SEED_ADMIN_EMAIL`, default `admin@knest.local`, `platformRole: other`, `staffRole: super_admin`, `emailVerified = now`); outside production also `student@knest.local` (non-staff, to prove the `/admin` refusal); then `seedCms()` |
| `seed-cms.ts` | called by both above | none (idempotent) | updates the `homepage` global: ten section rows (`enabled` preserved), and copy from `HOMEPAGE_COPY` **only if `heroHeadline` is empty** (`seed-cms.ts:28-38`) |
| `seed-demo.ts` (`db:seed:demo`) | local or disposable DB | `assertDemoSeedAllowed` then `resolveSeedPassword` (`seed-demo.ts:227-229`) | three accounts `admin@`, `founder@`, `investor@knest.local`; `seedCms`, `seedDummy`, plus demo infrastructure (3), partners, startups, mentors, events and articles via Payload |
| `seed-dummy.ts` / `seed-dummy-runner.ts` | local or disposable DB | the runner calls `assertDemoSeedAllowed` (`seed-dummy-runner.ts:5`) | seven fictional published programs |

## 3. Behavioural invariants

1. **No silent rewrite of an existing account.** If the e-mail exists and
   `mayModifyExistingUsers` is false the row is returned unchanged with action `kept`
   (`seed.ts:117-121`). Proven by `50-seeds.test.ts:44-49` (a re-run with a different password leaves the
   hash unchanged) and `:60-65` (only `SEED_RESET_EXISTING=true` changes it).
2. **Password hashing**: bcryptjs cost 12 (`seed.ts:114`). The seeded user is created with
   `emailVerified` set, so it can sign in at once.
3. **Staff copy is never overwritten**: test `50-seeds.test.ts:51-58`.
4. **Production refusal creates nothing**: `NODE_ENV=production` without `SEED_PASSWORD` exits non-zero
   with the "Refusing to seed" message and no row (`50-seeds.test.ts:67-73`).
5. **The published default is refused even when passed explicitly**
   (`50-seeds.test.ts:75-80`).
6. **No fabricated content in production seed.** Comment `seed.ts:99-106` (spec 46): no invented
   startups, mentors, metrics, testimonials or partnerships; counters read real tables and an empty
   ecosystem renders zero.
7. **Seeds write no audit rows for CMS changes**: they call the Payload local API without a user, and
   `audit-hooks.ts:21` skips when there is no actor.

## 4. Weak points to know about

- `seedDemoData` and `seedDummy` are exported functions; only the `main()` and the runner call the
  guard. Importing and calling `seedDummy()` elsewhere is unguarded (`seed-dummy.ts:4`).
- `seed.ts` as a production tool relies on the operator supplying `SEED_ADMIN_EMAIL`; if omitted a
  real production database would receive an account `admin@knest.local` (with the operator's
  `SEED_PASSWORD`). The policy does not check the address (see defect D-07).
- `seed-dummy.ts` passes `publishedAt` and `status` fields that are not on the Programs collection and
  casts the object `as any` (`seed-dummy.ts:55-60`); Payload ignores unknown fields.
- The "local host" list differs from `ssl.ts` (see `09`).
- The integration seed test creates accounts `seeded-admin@seed.test` and `student@knest.local` in the
  test database; they are test artefacts, not product data.

## 5. Procedure for first production data

1. Run migrations (`pnpm migrate`).
2. Run `db:seed` once with `SEED_PASSWORD` (12+ characters, unique) and `SEED_ADMIN_EMAIL` set, from a
   place that can reach the database. Production signals (`NODE_ENV=production`) should be set too.
3. Sign in, change the password through the platform, and create further staff by assigning
   `staff_role` in the members admin. Do not run `db:seed:demo`; it refuses in production by design.
