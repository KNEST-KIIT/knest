# Volume E4: Data layer and CMS

Engineering reference for the database (`app` and `cms` schemas, Drizzle and Payload migrations,
client, TLS, seeds, rate limiting, e-mail outbox) and the Payload CMS (collections, global, access,
hooks, auth bridge, media storage). Every statement cites a file and line range in the repository at
base `codex/production-v1`. Where the code does not show something, the text says "not determined
from the code"; the full list is in `19-defects-and-undetermined.md`.

Audience: engineers taking over the data layer, and privacy and security reviewers.

## Reading order

| # | File | Contents |
|---|---|---|
| 01 | `01-schema-split-and-conventions.md` | Why `app` and `cms` are separate, id-only cross references, column conventions, whole-system ER diagram |
| 02 | `02-identity-and-sessions.md` | `users`, `accounts`, `sessions`, `verification_tokens` |
| 03 | `03-applications-and-engagement.md` | applications, answers, documents, notifications, audit logs, event registrations, analytics, enquiries |
| 04 | `04-labs-and-attendance.md` | lab booking tables, exclusion constraint, QR attendance tables |
| 05 | `05-platform-tables-rate-limits-and-mail.md` | `rate_limits`, `email_outbox` column reference |
| 06 | `06-enums.md` | every PostgreSQL enum, origin migration, change rules |
| 07 | `07-drizzle-migration-history.md` | migrations 0000 to 0013 one by one, rollback and data effects |
| 08 | `08-payload-migrations.md` | Payload baseline and the two later migrations, drift test, how to change a collection |
| 09 | `09-client-pooling-ssl-and-roles.md` | pool, TLS modes, runtime database role |
| 10 | `10-seeds-and-production-refusal.md` | seed scripts and the production refusal policy |
| 11 | `11-rate-limit-sql.md` | token bucket SQL, derived behaviour, named limits |
| 12 | `12-email-outbox.md` | durable mail queue, state machine, worker, resend |
| 13 | `13-payload-config-and-access.md` | config, role areas, access helpers, access matrix |
| 14 | `14-payload-collections.md` | all 14 content collections and the staff mirror, field by field |
| 15 | `15-payload-globals-hooks-versions.md` | homepage global, audit hooks, delete guard, versions and drafts |
| 16 | `16-auth-bridge.md` | Auth.js to Payload strategy and the shadow staff row |
| 17 | `17-media-and-s3-storage.md` | media collection, S3 plugin, document storage, reconciliation |
| 18 | `18-data-classification.md` | per-table classification and privacy register |
| 19 | `19-defects-and-undetermined.md` | defects with file and line, and open questions |

## One-page orientation

- One PostgreSQL database, schemas `app` (Drizzle, 24 tables and 19 enums, migrations
  `src/db/migrations`) and `cms` (Payload, 80 tables, migrations `src/migrations`). A third schema
  `drizzle` holds only the migration bookkeeping table.
- Cross-schema links are plain ids with no foreign key: program, event and infrastructure ids from
  `app` into `cms`; user ids from founders and mentors into `app`.
- `pnpm migrate` runs Drizzle, then Payload, then the runtime-role script.
- Payload has no user table of its own: `cms.staff` is a shadow row written from `app.users` on each
  admin request after the Auth.js session is verified.
- Lab double-booking is prevented by a database exclusion constraint that exists only in SQL.
- Mail is stored before it is sent; rate limits are one atomic upsert per check.

## Source map

| Area | Paths |
|---|---|
| Drizzle schema | `src/db/schema/*.ts` |
| Drizzle migrations | `src/db/migrations/*.sql`, `meta/_journal.json`, `drizzle.config.ts` |
| Client, SSL, runtime role | `src/db/client.ts`, `ssl.ts`, `runtime-role.ts`, `migrate.ts` |
| Seeds | `src/db/seed*.ts` |
| Payload | `src/payload/` (`payload.config.ts`, `access.ts`, `audit-hooks.ts`, `auth-strategy.ts`, `collections/`, `globals/`, `fields/`) |
| Payload migrations | `src/migrations/` |
| Rate limit | `src/server/security/rate-limit.ts`, `route-limits.ts` |
| E-mail outbox | `src/server/email/outbox.ts`, `send.ts`, `admin.ts` |
| Storage | `src/server/storage/` |
| Tests cited | `tests/integration/20, 24, 34, 43, 50, 60`, `src/db/*.test.ts`, `src/payload/access.test.ts` |
