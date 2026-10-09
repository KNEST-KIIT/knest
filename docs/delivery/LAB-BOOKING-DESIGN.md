# Lab booking: design for local build (contract modules 25 to 29 and 32)

**Status: design, 2026-10-09.** Built locally behind `FEATURE_LAB_BOOKING` (off). **Nothing here is an approved lab policy.** Every operating rule is a stored setting with a recommended default from `HD-16-LAB-POLICY-QUESTIONNAIRE.md`; the lab heads and KNEST set the real values. Enabling the feature anywhere real needs HD-16 answered and signed by people. QR, signed passes, offline sync and PWA (modules 30, 31, 36 to 38) are **not built**: they wait for the threat-model review, real-device tests and lab-head review (`LAB-ATTENDANCE-THREAT-MODEL.md`). Attendance is recorded **manually**, labelled as such, which the threat model already treats as the baseline.

## Why the old code goes

The interim version keeps bookings in the CMS (`cms.lab_bookings`), which the contract forbids (module 2: no operational data in the CMS), checks overlap with a read-then-write that two simultaneous requests both pass, has no approval flow, and exposes booker identity fields to staff roles with no scoping. It is replaced, not extended.

## Data model (schema `app`, Drizzle migration)

| Table | Purpose |
|---|---|
| `labs` | One bookable space. Name, slug, department, optional link to the CMS `infrastructure` document that holds the public photos and description, capacity, **policy columns** (below), `is_active`. |
| `lab_hours` | Operating windows: lab, weekday 0 to 6, opens and closes as minutes after midnight (IST). Several windows per day allowed. |
| `lab_blackouts` | Closed date ranges with a reason (exams, holidays, maintenance). |
| `lab_staff` | Who runs a lab: `head` or `assistant`, unique per lab and person. A person need not have a staff role in the console; lab roles come only from here. |
| `lab_bookings` | A request: lab, member, start and end (timestamptz), purpose, headcount, equipment needed, status, decision (who, when, note), optional proposed alternative, assigned assistant. |
| `lab_attendance` | Manual attendance: booking, outcome (`attended` or `no_show`), who marked it, when, reason, method `manual`. |

**Double booking is impossible in the database**, not in application code: `lab_bookings` carries an exclusion constraint (`EXCLUDE USING gist (lab_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE status IN ('requested','approved','alternative_proposed')`, with `btree_gist`). Two simultaneous requests for one slot: one insert wins, the other fails with a conflict that the application reports as "that time was just taken". A rejected, cancelled or expired booking releases the slot.

Statuses: `requested`, `approved`, `rejected`, `cancelled`, `alternative_proposed`, `completed`, `no_show`. Allowed moves are a table in code (like applications), tested.

## Policy columns on `labs` (recommended defaults from HD-16, **not approved**)

`slot_minutes` 60; `max_consecutive_slots` 3; `min_lead_minutes` 240; `max_horizon_days` 14; `max_open_requests` 3; `max_hours_per_week` 6; `cancel_cutoff_minutes` 120; `eligibility` one of `verified`, `onboarded` (default), staff-granted; `requires_assistant` boolean. Changing a value changes behaviour for new requests only; nothing is hard-coded in rules.

## Flows

1. **Member** (signed in, e-mail verified, onboarded, eligible): chooses a lab, sees free and busy slots for a date (no other person's identity ever shown), picks consecutive slots, states purpose, headcount (at most capacity) and equipment, passes **Turnstile** (module 39), submits. Rate limited. The request is validated server-side against hours, blackouts, lead time, horizon, grid alignment, limits and eligibility.
2. **Head** (a person in `lab_staff` as head, or a `lab_admin` or super admin): per-lab queue. Approve (assigning an assistant where the lab requires one), reject with a reason, or propose an alternative slot. Every decision writes an audit row in the same transaction as the change, and notifies the member in the app and by e-mail. An alternative the member accepts becomes approved; one they decline releases the slot.
3. **Assistant**: sees only their own upcoming duties. Marks attended or no-show, **manually**, with a reason for any no-show or correction.
4. **Member cancels** up to the lab's cut-off; the head can cancel with a reason. Both notify.
5. **Heads maintain their own lab**: hours, blackout dates, assistants and policy values for labs they head, through `/dashboard/lab-staff`. A `lab_admin` or super admin creates labs and assigns heads through `/admin/labs`.
6. **Reports** (module 32): per lab and per department over a date range: requests, approvals, rejections, cancellations, attended, no-shows, hours booked and hours attended, manual entries shown separately. CSV download. Counted from the tables, reconcilable by a query.

## Security rules

- Booker identity (name, e-mail) is visible only to the lab's head and assistants for bookings in their lab, and to `lab_admin` and super admin. A member sees only their own bookings.
- No CMS collection holds booking data. The old REST surface is removed, so a probe returns not found.
- Status changes are conditional updates (a second reviewer loses cleanly), as for applications.
- Free and busy endpoint requires a session and returns times only.

## Tests that close it (integration, production build, real database)

Slot generation (hours, blackouts, lead, horizon, grid, past); **parallel requests for one slot yield exactly one request** (database constraint, 20 racing inserts); eligibility and limit enforcement; head, assistant and member scoping across labs (a head of lab A cannot read or decide lab B); decision flows with audit rows and notifications; alternative accept and decline; cancel cut-off; manual attendance; report totals reconcile with rows; Turnstile required; feature flag off means every route and action refuses.

## Explicitly not built (gated, see tracker)

Signed QR passes, two-sided scan, offline outbox, PWA install: blocked on the threat-model review, real-device test protocol results and lab-head review. Door control: not planned (HD-16 question 10).

## Known gaps (found in review, 2026-10-09)

- Requests nobody answers never expire and send no reminder, so they hold their slot and count against the member's open-request limit until someone acts. An expiry rule and a reminder are needed before the module is enabled.
- A head can approve a request whose start time has already passed.
- Assistants currently see every approved booking in their lab, with booker name and email. The design above says they see only their own duties; one of the two must change.
- A recorded attendance outcome cannot be corrected from the screens, although the design implies a correction with a reason.
- A lab that has been closed for booking cannot be reopened from the screens, because the lab console looks the lab up only while it is active.
