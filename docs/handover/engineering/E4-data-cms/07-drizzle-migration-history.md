# E4.07 Drizzle migration history, 0000 to 0013

Location: `src/db/migrations/`. Journal: `src/db/migrations/meta/_journal.json` (14 entries, idx 0 to 13,
dialect postgresql, version 7, `breakpoints: true`). Each migration has a snapshot
`meta/NNNN_snapshot.json`. Applied by `src/db/migrate.ts:10-14` with `migrationsSchema: 'drizzle'`;
bookkeeping table `drizzle.__drizzle_migrations`.

Run order is the journal order. The `when` value in the journal is the generation time (UTC, derived
from the epoch milliseconds in the file).

| idx | Tag (file) | Generated (UTC) | One-line effect |
|---|---|---|---|
| 0 | `0000_amused_namor` | 2026-08-29 14:16 | Creates schema `app`, identity tables |
| 1 | `0001_wet_rafael_vega` | 2026-08-29 15:08 | Mentor and goals columns on `users` |
| 2 | `0002_wonderful_ender_wiggin` | 2026-08-29 15:29 | Applications, answers, documents, notifications, audit |
| 3 | `0003_burly_venom` | 2026-08-29 16:27 | `event_registrations` |
| 4 | `0004_puzzling_stone_men` | 2026-08-30 05:38 | `analytics_events` |
| 5 | `0005_warm_outlaw_kid` | 2026-08-30 05:58 | `rate_limits` |
| 6 | `0006_lab_admin_role` | 2026-10-08 13:10 | `staff_role` gains `lab_admin` |
| 7 | `0007_application_question_snapshot` | 2026-10-09 05:20 | `applications.question_snapshot` |
| 8 | `0008_enquiries` | 2026-10-09 07:47 | `enquiries` and its enums |
| 9 | `0009_event_registered_notification` | 2026-10-09 08:01 | `notification_type` gains `event_registered` |
| 10 | `0010_lab_booking` | 2026-10-09 08:13 | Lab booking tables, `btree_gist`, exclusion constraint |
| 11 | `0011_email_outbox` | 2026-10-11 13:00 | `email_outbox` |
| 12 | `0012_lab_departments` | 2026-10-11 20:46 | `lab_departments`, `labs.department_id`, `escalate_after_hours` |
| 13 | `0013_lab_attendance_qr` | 2026-10-11 20:48 | QR attendance tables |

Names 0000 to 0005 are drizzle-kit generated; 0006 onward are hand-named. All are forward-only: the
repository contains no down migrations and drizzle-kit does not generate them. "Rollback" below
means what an operator would have to do.

General properties that apply to every entry:

- **Transactions.** Whether the Drizzle migrator wraps all pending files in one transaction is
  library behaviour not visible in this repository: not determined from the code. PostgreSQL's
  restriction that a value added by `ALTER TYPE ... ADD VALUE` cannot be used until commit is
  relevant to 0006, 0009 and 0010; none of those files uses the new value in the same file.
- **Ordering dependencies.** Every migration depends on the schema created by 0000. 0002 needs
  `app.users`. 0010 needs `app.users` and `app.notification_type` (extended after 0009). 0012 alters
  `labs` created in 0010. 0013 needs `lab_bookings` from 0010.
- **Idempotency.** Only 0006 is re-runnable (`IF NOT EXISTS`). The rest fail on a second manual run.
- **Verification.** `tests/integration/60-dependencies-and-migrations.test.ts:54-60` asserts the number
  of rows in `drizzle.__drizzle_migrations` equals the number of `.sql` files, and lines 62-74 assert
  that a second run of both migrators is a no-op.
- **Data effects.** Only 0006 to 0013 can meet populated production tables. Their data effects are
  stated individually.

## 0000_amused_namor

- Creates schema `app` (line 1), enums `journey_stage`, `platform_role`, `profile_visibility`,
  `staff_role` (6 values, no `lab_admin`), tables `accounts`, `sessions`, `users`,
  `verification_tokens`, FKs accounts and sessions to users with ON DELETE CASCADE, and indexes
  `accounts_user_id_idx`, `sessions_user_id_idx`, `users_staff_role_idx`, `users_platform_role_idx`.
- `users_email_unique` constraint. `skills`, `interests` arrays default `'{}'`.
- Ordering: must be first. It is why the Drizzle bookkeeping table lives in schema `drizzle`.
- Rollback: `DROP SCHEMA app CASCADE`. Destroys everything. Not a practical partial rollback.
- Data effects: none (empty database).

## 0001_wet_rafael_vega

- Creates enum `mentor_availability`; adds `users.goals`, `users.expertise_areas` (`text[] NOT NULL
  DEFAULT '{}'`), `users.years_of_experience`, `users.mentor_availability` (nullable).
- Rollback: drop the four columns and the type. Data in them is lost.
- Data effects: existing users get empty arrays and nulls. Adding a `NOT NULL DEFAULT` column
  rewrites no rows on modern PostgreSQL; version-specific, not determined from the code.

## 0002_wonderful_ender_wiggin

- Enums `application_field_type`, `application_status`, `notification_type` (3 values).
- Tables `applications`, `application_answers`, `application_documents`, `notifications`,
  `audit_logs` with the FKs and indexes in file 03. `audit_logs.actor_user_id` is RESTRICT.
- Rollback: drop five tables and three types in reverse dependency order.
- Data effects: none on existing data. `application_field_type` is created but never used (D-06).

## 0003_burly_venom

- Table `event_registrations`, FK to users CASCADE, UNIQUE `(user_id, event_id)`.
- Rollback: drop table; registrations lost.

## 0004_puzzling_stone_men

- Table `analytics_events`, FK `user_id` ON DELETE SET NULL, indexes on `event` and `user_id`.
- Rollback: drop table; the funnel history is lost and cannot be reconstructed.

## 0005_warm_outlaw_kid

- Table `rate_limits` (`key` PK, `tokens` double precision, `updated_at`). No indexes.
- Rollback: drop table. Safe in the sense that buckets simply restart full; but
  `checkRateLimit` would then throw (relation does not exist) on every limited route, so the
  application must be rolled back first.

## 0006_lab_admin_role

- `ALTER TYPE "app"."staff_role" ADD VALUE IF NOT EXISTS 'lab_admin' BEFORE 'super_admin'`.
- Why it exists: NF-04. The role existed in code and Payload access rules (`infrastructure: ['lab_admin']`,
  `src/server/auth/roles.ts:20`) but not in the enum, so assigning it failed. Test:
  `60-dependencies-and-migrations.test.ts:76-82`.
- Rollback: not possible by SQL. PostgreSQL cannot drop an enum value. Leaving the value in place is
  harmless; code that stops using it just never writes it.
- Data effects: none.

## 0007_application_question_snapshot

- `ALTER TABLE app.applications ADD COLUMN question_snapshot jsonb` (nullable).
- Why: R-04, review must be able to show what was asked after a program is edited.
- Rollback: drop the column; reviewers lose the original question text for submitted applications.
- Data effects: existing submitted applications keep null, and the code treats null as "submitted
  before this column" (`applications.ts:33-34`). There is no backfill in SQL.

## 0008_enquiries

- Enums `enquiry_status`, `enquiry_topic`; table `enquiries`; FKs `user_id` and `handled_by` to users,
  SET NULL; index `(status, created_at)`.
- Rollback: drop table and types; stored contact messages (personal data) are destroyed.

## 0009_event_registered_notification

- `ALTER TYPE notification_type ADD VALUE 'event_registered'` (not idempotent).
- Rollback: not possible by SQL (same reason as 0006). Existing rows of this type would also block a
  type rebuild until deleted or recast.

## 0010_lab_booking

The largest structural change.

- `CREATE EXTENSION IF NOT EXISTS btree_gist` (line 2). Needs a role allowed to create extensions;
  the web runtime role is deliberately not (`runtime-role.ts:9-12`), so this must run as the
  migration identity. Whether the managed database permits it for the chosen master user is not
  determined from the code (CI proves it against a local container only).
- Enums `lab_attendance_outcome`, `lab_booking_status`, `lab_eligibility`, `lab_staff_role`; four
  `ALTER TYPE notification_type ADD VALUE` statements (`booking_requested`, `booking_decided`,
  `booking_alternative`, `booking_cancelled`).
- Tables `lab_attendance`, `lab_blackouts`, `lab_bookings`, `lab_hours`, `lab_staff`, `labs` with CHECK
  constraints (listed in file 04), FKs (bookings RESTRICT on lab and user), indexes.
- Hand-written `lab_bookings_no_overlap` EXCLUDE constraint (lines 117-119), invisible to the
  snapshot.
- Rollback: drop the six tables and four types, then drop the constraint with the table. The four
  notification values and the extension remain. Booking history is destroyed.
- Data effects: none on prior data; adds new, empty tables. Note that these tables and the
  notification values exist in every environment even while `FEATURE_LAB_BOOKING` is off.

## 0011_email_outbox

- Enum `email_status`; table `email_outbox`; index `(status, next_attempt_at)`.
- Rollback: drop table. Any queued undelivered mail (including single-use links) is lost; drain or
  accept loss first.

## 0012_lab_departments

- Table `lab_departments` (self-referential FK SET NULL); `labs.department_id` (nullable FK SET NULL);
  `labs.escalate_after_hours integer NOT NULL DEFAULT 48`; CHECK `labs_escalate_positive`; indexes.
- Rollback: drop the added column, constraint and table. Hierarchy data lost.
- Data effects: every existing lab gets `escalate_after_hours = 48` and `department_id = NULL`. The old
  free-text `department` column is retained and there is no backfill of `department_id`.

## 0013_lab_attendance_qr

- Enums `lab_qr_check_state`, `lab_scan_action`, `lab_scan_side`, `lab_scan_status`; tables
  `lab_device_keys`, `lab_qr_checks`, `lab_scan_events`; RESTRICT FKs to bookings and users; unique
  indexes including two partial indexes; CHECKs `lab_device_keys_id_shape`,
  `lab_qr_checks_verified_has_both`, `lab_scan_events_client_times`.
- Rollback: drop three tables (children first: `lab_qr_checks`, then `lab_scan_events`, then
  `lab_device_keys`) and four types. Attendance evidence is destroyed.
- Data effects: none; empty tables, feature off by default.

## Cross-cutting observations

- **No drift test for Drizzle.** The "no schema drift" test (`60-...:34-52`) runs only Payload's
  `migrate:create`. Nothing in the test suite or `ci.yml` was found that runs `drizzle-kit generate`
  to prove `src/db/schema` and the SQL files agree. `pnpm db:generate` is a manual script
  (`package.json:18`). See D-05.
- **Hand-written SQL not in snapshots**: only the exclusion constraint in 0010.
- **Journal gap in time** between 0005 (2026-08-30) and 0006 (2026-10-08) reflects when development
  resumed, not a missing file; the idx sequence is contiguous 0 to 13.
- **Adding migration 0014**: change `src/db/schema`, run `pnpm db:generate`, review the SQL (rename
  the file if hand-named, keep the journal tag matching), then run `pnpm migrate`, which runs Drizzle,
  then Payload, then the runtime-role script (`package.json:20`).
