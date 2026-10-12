# E4.19 Defects noticed and items not determined from the code

Documentation only: nothing here was changed. Severity is a reviewer's suggestion.

## 1. Defects and risks

| ID | Severity | Location | Finding |
|---|---|---|---|
| D-01 | Medium | `src/payload/collections/events.ts` and `infrastructure.ts` (no `hooks`); `src/db/schema/events.ts:25`, `labs.ts:57` | Events and Infrastructure can be deleted in the CMS while `app.event_registrations.event_id` and `app.labs.infrastructure_id` still point at them. Only Programs has a delete guard (`programs.ts:39-59`) |
| D-02 | Medium | `src/db/schema/labs.ts:131-133`; `src/db/migrations/0010_lab_booking.sql:119`; `meta/0010_snapshot.json` | The `lab_bookings_no_overlap` exclusion constraint exists only in the hand-written SQL. It is absent from the Drizzle schema and the snapshot, so a database built any other way (for example `drizzle-kit push`) lacks the double-booking guarantee. The integration suite does exercise refusal of overlapping bookings against the migrated database (`tests/integration/34-lab-booking.test.ts:195`), so a migrated database is covered; a schema-only database is not |
| D-03 | Medium | `src/db/schema/security.ts:11-15`; `src/server/security/rate-limit.ts:59-72` | `app.rate_limits` is never purged and keys embed client IPs. Unbounded growth and indefinite IP retention |
| D-04 | Medium | `src/server/auth/session.ts:44-48`; `src/db/schema/users.ts:112-122` | Session tokens are stored in clear in `app.sessions.session_token` and equal the cookie value. Anyone able to read the table can use a live session. Verification and reset tokens are hashed (`tokens.ts:26-28`); sessions are not. Expired sessions are also never deleted |
| D-05 | Low | `package.json:18`; `tests/integration/60-dependencies-and-migrations.test.ts:34-52` | Schema drift is tested for Payload only. No check proves `src/db/schema` and `src/db/migrations` agree (for example `drizzle-kit check` or `generate` producing nothing) |
| D-06 | Low | `src/db/schema/enums.ts:88-95`; `0002_wonderful_ender_wiggin.sql:1` | `app.application_field_type` is created but unused by any column or code |
| D-07 | Medium | `src/db/seed.ts:156-158` | `db:seed` defaults the admin e-mail to `admin@knest.local` when `SEED_ADMIN_EMAIL` is unset, with no check that a real address is used in production. The policy guards the password, not the address |
| D-08 | Medium | `src/payload/collections/founders.ts:32-40`, `mentors.ts:60-69`; `access.ts:32-35` | `userId` (the internal `app.users.id`) is a normal field, so anonymous REST reads of a published founder or mentor return it. It is a UUID rather than a secret, but it is an internal account identifier exposed publicly with no field-level access |
| D-09 | Low | `src/payload/payload.config.ts:33-34` vs `44-46` | The comment says "No `meta.titleSuffix`" to avoid a doubled suffix, while the config sets `titleSuffix: ' — KNEST'`. One of the two is wrong |
| D-10 | Low | `src/payload/auth-strategy.ts:66` | Unfinished comment ("They are the") before the returned user |
| D-11 | Medium | `src/server/email/outbox.ts:132-161`; `src/db/schema/email-outbox.ts` | Outbox rows are never deleted: recipient address, subject and last error persist indefinitely. Only `body` is blanked. Also: the retry worker runs only when `NODE_ENV === 'production'` (`src/instrumentation.ts:3-15`, `src/server/env.ts:105-110`), so staging builds that are not production never retry |
| D-12 | Medium | `src/payload/auth-strategy.ts:50-64`; `src/payload/collections/staff.ts:29-33` | `cms.staff` rows are upserted but never removed; former staff remain with e-mail, name and last role, readable by all current staff via `/api/staff` |
| D-13 | Low | `src/payload/audit-hooks.ts:20-28` | CMS audit writes are best effort: a failed insert is swallowed and only logged, so the trail can have unrecorded gaps. Not in the same transaction as the content change |
| D-14 | Low | `src/db/seed-dummy.ts:55-60` | Seed passes `publishedAt` and `status`, which are not Programs fields, and casts to `any` |
| D-15 | Low | `src/db/migrate.ts:15,20`; `src/db/seed.ts:163` | Console output uses the Unicode check and cross characters. They are not emoji pictographs in the usual sense, but the project rule is no emoji anywhere and `scripts/check_no_emoji.py` should be run to confirm whether they pass |
| D-16 | Low | `src/db/ssl.ts:21` vs `src/db/seed-policy.ts:15` | Two different lists of "local" hosts (`ssl.ts` has four entries; `seed-policy.ts` adds `host.docker.internal` and `::1`). Not harmful today, but easy to diverge |
| D-17 | Low | `drizzle.config.ts:7` | `process.env.DATABASE_URL!` non-null assertion; with the variable unset the failure appears at connection time with a driver error, not a clear message |
| D-18 | Info | `src/payload/access.ts:37` | `isAnyStaff` is exported and not referenced anywhere else in `src/` |
| D-19 | Info | `src/migrations/index.ts:19` | Last entry lacks a trailing comma. Generated file; harmless |
| D-20 | Medium | `src/server/enquiries/actions.ts:28-32` | The staff notification e-mail copies the visitor's name, address and full message into `email_outbox.body` and out to the notify address; body is blanked after send but the plain text also leaves the system by mail by design. Flag for the privacy register |

## 2. Not determined from the code

| Topic | What is missing |
|---|---|
| Postgres version and whether the Drizzle migrator wraps all pending migrations in one transaction | Library and infrastructure facts, not in the repo. Relevant to `ALTER TYPE ... ADD VALUE` in 0006, 0009, 0010 |
| Whether `CREATE EXTENSION btree_gist` (migration 0010) is permitted for the production owner role | Depends on the managed database; CI proves it only on a local container |
| Pool settings for Payload's own `pg` pool | Only `connectionString` and `ssl` are set (`payload.config.ts:102`) |
| Payload defaults for version retention, document locks, CSRF and CORS | Not set in config; library defaults not visible |
| Whether `testimonials.consentGiven` blocks saving an unchecked box | `required: true` on a checkbox; admin UI behaviour not verifiable here |
| Whether `sharp` strips EXIF on resized variants and whether originals are stored as uploaded | Not configured in `media.ts` |
| Bucket policy, lifecycle rules, encryption, versioning of the S3 bucket | Infrastructure, not in this repository's reviewed files |
| Case normalisation of `users.email` | The unique constraint is case-sensitive; normalisation is in auth code not reviewed in full |
| Which callers of `checkRateLimit` fail open or closed on a database error | Not shown in `rate-limit.ts`; call sites vary |
| Exact rate-limit key composition for each named limit | Only some call sites were read; the table in `11` marks inferred rows |
| How `lab_attendance` is read by reporting queries | No direct `from(labAttendance)` found; joins in `reports.ts` and `service.ts` not traced |
| Full set of `audit_logs.action` values | Some are built from template strings; list in `03` is from literal matches |
| Whether any environment ever held rows in the dropped `cms.lab_bookings` | No data access to databases |
| Data retention periods approved by KIIT | No policy file in the repository was found |
