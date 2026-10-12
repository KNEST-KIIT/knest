# E4.06 PostgreSQL enum types

All enums live in schema `app`. Declared in `src/db/schema/enums.ts`, `enquiries.ts`,
`email-outbox.ts`, `labs.ts`, `lab-attendance-qr.ts`. The "Created in" column is the migration that
first created the type; "Extended in" lists `ALTER TYPE ... ADD VALUE` migrations.

| Type | Values (in declared order) | Used by column | Created in | Extended in |
|---|---|---|---|---|
| `platform_role` | student, founder, mentor, investor, alumni, partner, other | `users.platform_role` (default `student`) | 0000 | none |
| `staff_role` | reviewer, content_admin, program_manager, startup_manager, mentor_manager, lab_admin, super_admin | `users.staff_role` | 0000 (without `lab_admin`) | 0006 adds `lab_admin` before `super_admin` |
| `journey_stage` | exploring, idea, validation, mvp, early_revenue, scaling, established | `users.journey_stage` | 0000 | none |
| `profile_visibility` | public, community, private | `users.profile_visibility` (default `community`) | 0000 | none |
| `mentor_availability` | open, limited, unavailable | `users.mentor_availability` | 0001 | none |
| `application_status` | draft, submitted, under_review, shortlisted, interview, accepted, rejected, waitlisted | `applications.status` (default `draft`) | 0002 | none |
| `application_field_type` | text, textarea, select, multiselect, url, file | **no column** (see below) | 0002 | none |
| `notification_type` | application_received, application_status_changed, application_deadline_reminder, event_registered, booking_requested, booking_decided, booking_alternative, booking_cancelled | `notifications.type` | 0002 (first three) | 0009 `event_registered`; 0010 four `booking_*` |
| `enquiry_topic` | general, program, partnership, mentor, press, support | `enquiries.topic` | 0008 | none |
| `enquiry_status` | new, handled | `enquiries.status` | 0008 | none |
| `lab_eligibility` | verified, onboarded | `labs.eligibility` | 0010 | none |
| `lab_staff_role` | head, assistant | `lab_staff.role` | 0010 | none |
| `lab_booking_status` | requested, approved, rejected, cancelled, alternative_proposed, completed, no_show | `lab_bookings.status` | 0010 | none |
| `lab_attendance_outcome` | attended, no_show | `lab_attendance.outcome` | 0010 | none |
| `email_status` | pending, sent, expired, dead | `email_outbox.status` | 0011 | none |
| `lab_scan_side` | staff, student | `lab_scan_events.side` | 0013 | none |
| `lab_scan_action` | in, out | `lab_scan_events.action`, `lab_qr_checks.action` | 0013 | none |
| `lab_scan_status` | accepted, review, rejected | `lab_scan_events.status` | 0013 | none |
| `lab_qr_check_state` | partial_staff, partial_student, verified | `lab_qr_checks.state` | 0013 | none |

## Rules for changing an enum

1. **Add a value**: write a hand-named migration containing only `ALTER TYPE "app"."<name>" ADD
   VALUE ...` (precedent: `0006_lab_admin_role.sql`, `0009_event_registered_notification.sql`). The
   TypeScript enum in `enums.ts` must be updated in the same change so that `staffRole.enumValues`
   (read by `src/server/auth/roles.ts:3-4`) matches. The NF-04 defect was exactly a missing
   migration: the role existed in code and in Payload access rules but not in the database enum
   (`tests/integration/60-dependencies-and-migrations.test.ts:76-82`).
2. **Remove or rename a value**: PostgreSQL has no `DROP VALUE`; this needs a type rebuild and a data
   migration. No precedent exists in the history.
3. **Order matters only for comparison and `BEFORE`/`AFTER` placement**; 0006 placed `lab_admin`
   `BEFORE 'super_admin'` so that declared order and database order agree.
4. **Idempotency**: 0006 uses `ADD VALUE IF NOT EXISTS`; 0009 and the four additions in 0010 do not,
   so re-running a partially applied copy of those files would fail with "already exists". The Drizzle
   migrator records applied migrations and does not re-run them, so this matters only for hand
   execution.

## Observations

- `application_field_type` is declared (`enums.ts:88-95`) and created (`0002:1`) but no table column
  uses it, and no TypeScript code imports `applicationFieldType`. The program question field type
  lives in Payload (`cms.enum_programs_application_questions_field_type`, baseline
  `20261008_114259_baseline.ts:17`). Harmless; it is an orphan type. See defect D-06.
- The CMS taxonomy (stage, sector, audience, format, expertise) is **not** a Postgres enum in `app`.
  It is defined once in `src/payload/fields/taxonomy.ts` and materialised as Payload-generated enums
  in `cms`. `journey_stage` in `app` and `STAGE_OPTIONS` in the CMS carry the same seven values
  (`taxonomy.ts:8-16`) but are two independent definitions that must be edited together.
- `mentor_availability` mirrors the CMS Mentors `availability` select (`enums.ts:58-63`,
  `mentors.ts:47-56`); same values, two definitions.
- Payload enums for `cms` are generated, named `enum_<collection>_<field>` and
  `enum__<collection>_v_version_<field>` for version tables, and are not hand-maintained (see
  `08-payload-migrations.md`).
