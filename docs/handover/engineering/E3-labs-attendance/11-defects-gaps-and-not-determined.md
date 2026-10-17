# E3.11 Defects, gaps and items not determined

Found by reading the code on `codex/production-v1` at `383abf9`. None was reproduced on a running system unless stated; each is "from reading the code". No code was changed. Severity is the author's judgement for a deployment where the relevant flag is on: High (blocks the feature or loses data), Medium (wrong or surprising result, workaround exists), Low (cosmetic or narrow).

**Follow-up, 2026-10-17:** D-01 and D-13 are repaired in the continuation candidate and covered by production-build integration tests. D-14's ongoing completed bookings are retained in the console, with repeat attendance/cancellation controls removed. Both roster queries also check current lab membership, closing stale-assignment visibility after removal; D-07's stored assignment itself is not cleared by this patch. The three affected suites passed 69 tests. See `../../../delivery/CONTINUATION-2026-10-17.md` for scope and limits. The rows below remain the original findings at `383abf9`; QR is still gated and D-05/D-12 remain open.

## 1. Defects and gaps

| ID | Sev | Finding | Where |
|---|---|---|---|
| D-01 | High | A lab switched off (`is_active = false`) cannot be reopened by any screen or route. Every lookup uses active labs only: the console layout 404s, and the `manage` route 404s because it resolves the lab with `getLabBySlug`. The admin list still links to the console, and the `isActive` checkbox exists only inside that console. Operations guide warns of this | `service.ts:64-66`; `lab-staff/[slug]/layout.tsx:14-17`; `api/labs/[slug]/manage/route.ts:10-12`; `(staff)/admin/labs/page.tsx:101-103`; `controls.tsx:268, 322` |
| D-02 | Medium | Accepting a suggested alternative approves the booking without an assistant, even when the lab requires one, writes no audit row for accept or decline, and does not notify the heads on accept | `service.ts:248, 293-310` |
| D-03 | Medium | A head can approve a request whose start has already passed. Approval checks status, assistant and blackouts only. Known gap in the design note | `service.ts:215-230`; `LAB-BOOKING-DESIGN.md:166` |
| D-04 | Low | A suggested alternative is not checked against current bookings, so a head can propose a taken time; the member learns it only when accepting | `service.ts:239-251, 312` |
| D-05 | High (if QR on) | No screen lists or acts on held scans, lists device keys, or revokes a key. `/api/lab-attendance/reviews`, `/reviews/[id]`, `/keys` (GET) and `/keys/[id]/revoke` have no caller in `src/app` or `src/lib`. Held scans, key revocation and the lost-phone path (T14) are API only | `src/app/api/lab-attendance/reviews*`, `keys/**`; absence confirmed by grep |
| D-06 | Medium | Attendance cannot be corrected. Both outcomes are terminal and no function edits `lab_attendance`. Known gap | `rules.ts:155-158`; `service.ts:363-390`; `LAB-BOOKING-DESIGN.md:168` |
| D-07 | Medium | Removing a person from a lab's staff does not clear `assistant_user_id` on their bookings. The booking stays assigned to someone who can no longer mark attendance or scan (`not-staff`) | `manage.ts:216-219` |
| D-08 | Medium | The report has no QR attendance source. `manualEntries` counts `method = 'manual'` only; QR check-ins appear only inside `attended`. `hoursAttended` is booked hours, not time present | `reports.ts:45-50, 75-77` |
| D-09 | Medium | All QR routes share the `labScan` bucket (600 per hour per user). The pass screen polls `bookings/[id]/checks` every 5 s while online (720 per hour). Net drain is about 0.033 tokens per second (consumption 0.2, refill 0.1667), so an open pass screen exhausts the bucket in about 5 hours (computed, not measured). Then scans are answered 429; the outbox treats that as retry; and `probeOffline` treats any non-OK, non-401 answer as offline, so scans are signed as offline | `rate-limit.ts:44`; `pass-panel.tsx:78-97`; `device-app.tsx:121-129`; `outbox.ts:109-110` |
| D-10 | Low | `lab_device_keys.last_used_at` is read and returned but nothing writes it | `lab-attendance-qr.ts:36`; `attendance-qr.ts:34` |
| D-11 | Medium | No segregation of duties on the staff side. A person who is staff of the lab (or head or admin) and also the booker of an approved booking assigned to them can complete both halves of the exchange alone, including from one device by pasting their own pass text. A head can also approve their own request and mark their own attendance by hand. No test covers it. Trust in staff is the model's stated assumption (T7), but the record would not distinguish it | `decide.ts:128-135`; `service.ts:198-207, 370` |
| D-12 | High (if QR on) | Key lifecycle dead ends. (a) After revocation the device keeps `registered: true` and never creates a new key; scans are refused `key-revoked`. (b) Storage eviction creates a new key but leaves the old one active, counted toward the cap of 5. (c) At the cap registration returns `limit`, and the only way to free a slot is an API call, since there is no key screen (D-05). A person can be locked out of the pass | `device-key.ts:25-28, 49-65`; `attendance-qr.ts:24, 64, 67-68` |
| D-13 | High (if QR on) | Check-out through the assistant roster is predicted to fail. `getRoster` returns only `approved` bookings, but a verified check-in sets the booking to `completed`. After the assistant's roster refresh the booking is gone and `scanStudentPass` answers `not-on-roster`. The server would accept the check-out. The duties list `listRoster` has the same filter | `attendance-qr.ts:239, 507`; `flows.ts:47-48`; `service.ts:438`; test submits events directly `44:226` |
| D-14 | Low | After a manual attended mark or a QR check-in the booking is `completed` and disappears from the console's "upcoming" and "recent history" lists until its end time passes (upcoming requires `approved`; history requires `endsAt < now`) | `service.ts:415, 420` |
| D-15 | Low | A booker's own cancellation writes no audit row, and the assigned assistant is notified of no cancellation | `service.ts:339-341, 350-352` |
| D-16 | Low | The camera re-delivers a code that stays in view every 4 s. Each delivery becomes a new event id; the server rejects the repeats as `replay` and the "not counted" total grows | `parts.tsx:78`; `attendance-qr.ts:459-467` |
| D-17 | Low | Camera permission is allowed for the whole origin (`camera=(self)`); the threat model asked for the scan page only | `next.config.ts:83`; `threat-model:69` |
| D-18 | Medium | A request nobody answers never expires. After its start passes it is no longer escalated, still counts toward the booker's open-request limit, and the member's page offers no cancel button for it (shown only when `endsAt >= now`). A head can still reject it. Known gap | `service.ts:140, 492`; `lab-booking/page.tsx:101-105`; `LAB-BOOKING-DESIGN.md:165` |
| D-19 | Low | Lab slug probing is a read loop; two simultaneous creations of the same name can collide on the unique index and surface as an uncaught error | `manage.ts:55-64` |
| D-20 | Low | Department re-parenting checks cycles against a snapshot with no lock; two concurrent moves could create a cycle. Readers tolerate cycles | `department-admin.ts:64-76`; `departments.ts:9-20, 36` |
| D-21 | Low | Service worker cache name is fixed and old hashed assets are never pruned except by a wipe | `sw.js:15, 82-84` |
| D-22 | Low | `lab_hours_set` audit stores only the number of windows, so the previous timetable cannot be recovered from the trail | `manage.ts:148` |
| D-23 | Medium | Approving a held scan does not re-check revocation, slot or booking status at approval time, and for a `no_show` booking yields a `verified` check with no attendance row and the booking unchanged | `attendance-qr.ts:545-567`; `decide.ts:93` |
| D-24 | Low | Capacity is a headcount cap only; the exclusion constraint allows one live booking per lab at any time regardless of `capacity`. Possibly intended; recorded because the setting name suggests concurrency | `0010_lab_booking.sql:119`; `rules.ts:106` |
| D-25 | Low | A removal of a staff member or department leaves free-text labels and assignments as they were (department label is not cleared when a department is deleted) | `department-admin.ts:83-92` |

## 2. Documents that are out of date relative to the code

- `LAB-BOOKING-DESIGN.md:167` says assistants see every approved booking in their lab. The code filters to assigned bookings (`service.ts:409-428`).
- `LAB-HEAD-REVIEW-PACKET.md:95` says "nothing here has been built yet".
- `reports.ts:48-50` comment says manual entries are the only attendance source "until automated check-in exists".

## 3. Not determined from the code reviewed

- The wording, delivery and retry behaviour of e-mail (`sendNotificationEmail`, migration 0011 outbox) and the notification templates; reviewed only as call sites.
- Whether a repository check would catch loss of the hand-written exclusion constraint if the schema were regenerated from TypeScript.
- How personal-data erasure treats users who have bookings, device keys or scan events, given the `restrict` foreign keys.
- What happens to bookings of a user who is deactivated (their keys stop resolving in QR; the booking rows are untouched).
- The QR symbol version and module count for a 262 character token at error correction M.
- Behaviour of any part of the device app on a real phone: key persistence, camera, service worker offline load, Background Sync, storage eviction, install (E3.10).
- Whether `visibilitychange` and `online` fire reliably in a backgrounded iOS web app.
- The final lab policy values (HD-16 is unanswered in the repository).
- Whether a deployment's reverse proxy or CDN caches or rewrites `/sw.js` or `/manifest.webmanifest` (infrastructure is outside this volume).
- The behaviour of the staff console area checks around `/admin/labs` (outside this volume).
