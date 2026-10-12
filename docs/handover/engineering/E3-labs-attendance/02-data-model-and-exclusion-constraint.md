# E3.02 Data model and the database exclusion constraint

Schema files: `src/db/schema/labs.ts` (182 lines), `src/db/schema/lab-attendance-qr.ts` (116 lines). SQL: `src/db/migrations/0010_lab_booking.sql`, `0012_lab_departments.sql`, `0013_lab_attendance_qr.sql`. All tables are in the `app` schema; no lab data lives in the CMS (`labs.ts:9-10`). The earlier CMS `lab_bookings` collection was dropped by `src/migrations/20261009_083013_drop_cms_lab_bookings.ts`.

## 1. Tables

| Table | Migration | Purpose | Delete behaviour of its references |
|---|---|---|---|
| `lab_departments` | 0012 | Department tree (`parent_id` self reference) | parent: `set null` |
| `labs` | 0010, 0012 | One bookable space and its policy columns | `department_id`: `set null` |
| `lab_hours` | 0010 | Weekly opening windows | lab: `cascade` |
| `lab_blackouts` | 0010 | Closed date ranges | lab: `cascade` |
| `lab_staff` | 0010 | Head or assistant of one lab | lab and user: `cascade` |
| `lab_bookings` | 0010 | A request and its life | lab and booker: `restrict`; `decided_by`, `assistant_user_id`: `set null` |
| `lab_attendance` | 0010 | One outcome per booking, `method` `manual` or `qr` | booking: `cascade`; `marked_by`: `set null` |
| `lab_device_keys` | 0013 | A person's registered device public key | user: `restrict`; `revoked_by`: `set null` |
| `lab_scan_events` | 0013 | Append-only scan events with the signed token | booking, scanner user: `restrict`; `reviewed_by`: `set null` |
| `lab_qr_checks` | 0013 | Per booking and direction: partial or verified | booking, both events: `restrict` |

Consequence of the `restrict` rules: a user who has a booking, a registered device key or a scan event cannot be hard-deleted while those rows exist (`0010:100`, `0013:54, 56-60`). Whether an erasure procedure exists for such users is not determined from the code reviewed here.

## 2. `labs` policy columns

All operating rules are columns, not constants (`labs.ts:60-71`). Defaults are "recommended defaults from HD-16 and are NOT an approved policy" (`labs.ts:10-11`).

| Column | Default | DB check (`labs.ts:81-84`) | Zod range on edit (`manage.ts:24-41`) |
|---|---|---|---|
| `capacity` | 1 | `> 0` | 1 to 500 |
| `slot_minutes` | 60 | 15 to 480 | 15 to 480 |
| `max_consecutive_slots` | 3 | `> 0` | 1 to 24 |
| `min_lead_minutes` | 240 | `>= 0` | 0 to 43,200 (30 days) |
| `max_horizon_days` | 14 | `> 0` | 1 to 365 |
| `max_open_requests` | 3 | `> 0` | 1 to 50 |
| `max_hours_per_week` | 6 | `> 0` | 1 to 168 |
| `cancel_cutoff_minutes` | 120 | `>= 0` | 0 to 20,160 (14 days) |
| `eligibility` | `onboarded` | enum `verified`, `onboarded` | same |
| `requires_assistant` | false | - | boolean |
| `escalate_after_hours` | 48 | `> 0` | 1 to 720 |
| `is_active` | true | - | admin only (`manage.ts:98`) |

The design document mentions an eligibility of "staff-granted" (`docs/delivery/LAB-BOOKING-DESIGN.md:137`); the enum has only two values.

`slug` is unique, `infrastructure_id` is unique (a plain integer pointing at a CMS document; there is no foreign key across schemas, `labs.ts:56-57`).

## 3. `lab_bookings`

Columns of note: `starts_at`, `ends_at` (`timestamptz`), `status` enum (`requested`, `approved`, `rejected`, `cancelled`, `alternative_proposed`, `completed`, `no_show`), `proposed_starts_at`, `proposed_ends_at`, `assistant_user_id`, `decision_note`. Checks: `ends_at > starts_at`, `headcount > 0`, proposal order (`0010:48-50`).

### 3.1 The exclusion constraint

`0010_lab_booking.sql:119`:

```sql
ALTER TABLE "app"."lab_bookings" ADD CONSTRAINT "lab_bookings_no_overlap"
  EXCLUDE USING gist ("lab_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" IN ('requested', 'approved', 'alternative_proposed'));
```

It needs `CREATE EXTENSION IF NOT EXISTS btree_gist` (`0010:2`) because equality on a `text` column inside a GiST index is not available without it.

How to read it:

- **Same lab, overlapping time, both live: refused by PostgreSQL**, whatever the application does. The application's own pre-check (`problemWithRequest`) and availability list are courtesy; this is the final word (`rules.ts:89-92`). SQLSTATE `23P01` is mapped to the conflict message `Someone else just took that time. Pick another slot.` at `service.ts:47-53, 168`, and to a different message when accepting a proposal (`service.ts:312`).
- **`tstzrange(a, b)` is half-open `[a, b)`**, so a booking ending at 10:00 and one starting at 10:00 do not conflict. The integration test asserts touching times do not conflict (`tests/integration/34-lab-booking.test.ts:195`).
- **Terminal statuses release the slot**: `rejected`, `cancelled`, `completed`, `no_show` are outside the `WHERE`. Moving a row out of the live set removes it from the index; moving a row into it (accepting a proposal changes times and status in one `UPDATE`) is evaluated at that statement.
- **One booking at a time per lab, regardless of `capacity`.** The constraint has no notion of headcount. `capacity` is only an upper bound on one booking's `headcount` (`rules.ts:106`). A lab with capacity 20 still accepts one live booking in any time range. If KIIT intends several concurrent bookings per lab, this constraint would have to change; that is a product decision not recorded in the code.
- **Unanswered requests block the slot.** `requested` and `alternative_proposed` are live, so a pending request makes the slot show busy in availability (`service.ts:80-84`) and counts against the person's open-request limit.
- **The proposed alternative is not protected.** `proposed_starts_at` and `proposed_ends_at` are outside the range expression, so a head can propose a time that is already taken, and the member finds out only when accepting (E3.04 section 5).

The constraint exists only in the hand-written SQL migration; the Drizzle schema carries a comment saying so (`labs.ts:130-134`) and cannot express it. Regenerating migrations from the TypeScript schema would not reproduce it. Whether the repository has a drift check that would catch its loss is not determined from the code reviewed.

Evidence of effect: 20 simultaneous inserts for one slot yield exactly one row (`tests/integration/34-lab-booking.test.ts:182`).

## 4. `lab_attendance`

One row per booking: `lab_attendance_booking_idx` is a unique index on `booking_id` (`labs.ts:181`). `method` is free `text`, default `manual`; the QR path writes `qr` with `marked_by = null` (`attendance-qr.ts:511`). Because of the unique index a verified QR check-in can never overwrite a manual row, and vice versa (`onConflictDoNothing`, same line).

## 5. QR tables (migration 0013)

### `lab_device_keys`

- `id` is a 16 character string, enforced `char_length(id) = 16` (`0013:15`). It is derived from the key: the first 12 bytes of SHA-256 of the raw public key, base64url (`lab-attendance-qr.ts:29`, `keys.ts:41-44`). The id cannot be chosen by the caller because registration recomputes it (`attendance-qr.ts:53`).
- `public_key` is the 65 byte uncompressed P-256 point, base64url, unique (`0013:63`). Two accounts cannot register the same public key.
- `revoked_at`, `revoked_by`, `revoked_reason`. Revocation is soft; rows are never deleted.
- `last_used_at` exists but nothing in `src/` writes it (finding D-10).
- A user is limited to 5 active keys in code (`attendance-qr.ts:24, 67-68`), not in the database.

### `lab_scan_events`

Every event from a signed-in submitter whose envelope verified is kept, with the signed token verbatim (`lab-attendance-qr.ts:49-51`). Columns: `id` (client-chosen UUID, primary key, the idempotency key), `side` (`staff` or `student`), `action` (`in` or `out`), `scanner_user_id`, `scanner_key_id`, `inner_key_id`, `inner_user_id`, `inner_nonce`, `inner_step`, `token`, `status` (`accepted`, `review`, `rejected`), `code`, `client_at_ms`, `client_sync_at_ms`, `effective_at`, `received_at`, `reviewed_by`, `reviewed_at`, `review_note`. A check forces both client times `> 0` (`0013:51`).

Replay is enforced by two **partial unique indexes** (`0013:68-69`, `lab-attendance-qr.ts:86-91`):

| Index | Columns | Applies to | Meaning |
|---|---|---|---|
| `lab_scan_events_staff_nonce_idx` | `(inner_key_id, inner_nonce)` | `side = 'staff' and status <> 'rejected'` | A student's pass nonce can be used by one live staff event |
| `lab_scan_events_student_nonce_idx` | `(scanner_key_id, inner_nonce)` | `side = 'student' and status <> 'rejected'` | One student key can use a given desk challenge nonce once; several students may scan the same challenge |

`status <> 'rejected'` includes `review`. A held event therefore keeps its nonce; a declined review (status becomes `rejected`) frees it (`attendance-qr.ts:558`). Rejected events are stored with `inner_key_id` and `inner_nonce` null (`attendance-qr.ts:433-436, 464`), so rejected rows never occupy the indexes.

### `lab_qr_checks`

Unique on `(booking_id, action)`. State enum `partial_staff`, `partial_student`, `verified`; a check constraint requires both event ids and `verified_at` when `state = 'verified'` (`0013:27`). The row stores the two event ids it paired.

## 6. Indexes worth knowing

`lab_bookings(lab_id, starts_at)`, `(user_id, created_at)`, `(status)`, `(assistant_user_id, starts_at)` serve the console lists, the member list, the review of open requests and the assistant roster. `lab_scan_events(booking_id, action)` serves pairing; `(status, received_at)` serves the review queue; `(scanner_user_id, received_at)` serves per-person history (no screen uses it, not determined).

## 7. Which invariants live where

Two invariants are enforced in the database and not only in code: no overlapping live bookings (exclusion), and a verified check always has both events (check constraint). Three are enforced only in application code: the cap of five active device keys per person, department cycle prevention (`labs.ts:28-31`, `manage.ts` comment; the actual function is `departments.ts:23-27` called from `department-admin.ts:71`), and the booking state machine (`rules.ts:151-161`). The state machine is also enforced by conditional `UPDATE ... WHERE status = <expected>` (E3.04 section 2), which makes concurrent decisions safe but does not prevent a hand-run SQL update from making an illegal move.
