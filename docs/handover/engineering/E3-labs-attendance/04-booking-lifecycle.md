# E3.04 Booking lifecycle and its allowed transitions

Sources: `src/server/labs/rules.ts:146-178`, `src/server/labs/service.ts:176-390`, `src/server/labs/access.ts`, tests `rules.test.ts:145-163`, `tests/integration/34-lab-booking.test.ts:267-440`.

## 1. The state machine

`BOOKING_TRANSITIONS` (`rules.ts:151-159`) is the complete list. "Anything not listed is refused, whoever asks" (`rules.ts:150`).

```
requested ----> approved ----> completed
    |              |----------> no_show
    |              '----------> cancelled
    |----> alternative_proposed ----> approved
    |              |----------------> cancelled
    |              '----------------> rejected
    |----> rejected
    '----> cancelled
```

As a table:

| From | Allowed to | Terminal? |
|---|---|---|
| `requested` | `approved`, `rejected`, `alternative_proposed`, `cancelled` | no |
| `alternative_proposed` | `approved`, `cancelled`, `rejected` | no |
| `approved` | `cancelled`, `completed`, `no_show` | no |
| `rejected`, `cancelled`, `completed`, `no_show` | none | yes |

`LIVE_STATUSES = requested, approved, alternative_proposed` (`rules.ts:164`) is "the same list as the database exclusion constraint" and is used by the application's own overlap reads. Keep the two in step by hand: nothing derives one from the other.

Which function performs which edge:

| Edge | Function | Actor | Extra conditions |
|---|---|---|---|
| (new) -> `requested` | `requestBooking` | member | eligibility, rules, limits (E3.03) |
| `requested` -> `approved` | `decideBooking` approve | head or admin | status must be exactly `requested` (`service.ts:217`); assistant if the lab requires one; date not blacked out now |
| `requested` or `alternative_proposed` -> `rejected` | `decideBooking` reject | head or admin | reason of at least 3 characters (`service.ts:234-235`) |
| `requested` -> `alternative_proposed` | `decideBooking` propose | head or admin | proposal must itself satisfy `problemWithRequest` |
| `alternative_proposed` -> `approved` | `respondToProposal` accept | the booker | proposed start still in the future; rules re-checked with zero lead time |
| `alternative_proposed` -> `cancelled` | `respondToProposal` decline, or `cancelBooking` | the booker; head or admin for cancel | |
| `requested` or `approved` -> `cancelled` | `cancelBooking` | booker, head, admin | cut-off applies to the booker on `approved` |
| `approved` -> `completed` | `markAttendance` attended, or a verified QR check-in | assigned assistant, head, admin; or the QR server path | booking has started |
| `approved` -> `no_show` | `markAttendance` no_show | as above | reason of at least 3 characters |

## 2. Concurrency: conditional updates, not locks

Every transition is `UPDATE lab_bookings SET ... WHERE id = $id AND status = $statusJustRead RETURNING id`, inside a transaction together with the audit row and the notification row. If zero rows come back the caller gets a `state` error (HTTP 409) and nothing else was written:

- `decideBooking`: `service.ts:253-259, 271` ("Someone else decided this request first. Reload to see its current state.").
- `respondToProposal`: `service.ts:293-310`.
- `cancelBooking`: `service.ts:343-356`.
- `markAttendance`: `service.ts:377-388`.

Why: two heads (or a head and an admin) open the same request; both read `requested`; exactly one conditional update matches. The integration test sends two simultaneous decisions and asserts exactly one audit row and one notice (`34-lab-booking.test.ts:338`).

The exclusion constraint is a second, independent guard that covers the one case the status condition does not: two *different* rows contending for the same time (E3.02 section 3.1).

## 3. `decideBooking` in detail (`service.ts:194-274`)

1. Load the booking with its lab and booker. Unknown id: `not-found`.
2. `actorFor(lab.id)` and `requireManager`: a lab admin, or the head of **this** lab. An assistant, a head of another lab, and the booker all get 403 (test `34:352`).
3. **Override rule.** `override = actor.isAdmin && actor.role !== 'head'`; `overrideOfHead = override && the lab has at least one head` (`service.ts:203-204`). When a head exists and an admin decides, a note of at least 3 characters is required, "so the decision is never silent" (`service.ts:201-207`). The audit `after` then carries `override: true`, `headPresent`, `reason` (`service.ts:266`). An admin who is also the lab's head is not an override.
4. Per action:
   - **approve:** refuses unless status is exactly `requested`. If `lab.requiresAssistant` an `assistantUserId` is mandatory. If given, the person must be in `lab_staff` for this lab, in any role (so a head can be the assigned assistant). Re-reads the lab's blackouts and refuses if the booking's IST date is now closed (`service.ts:223-227`). There is **no check that the start time is still in the future** (E3.11, D-03).
   - **reject:** `canTransition(status, 'rejected')`; reason required.
   - **propose:** status must be `requested`; the proposed range goes through `problemWithRequest` with the booking's headcount and the lab's real lead time and horizon; on success writes `proposed_starts_at`/`proposed_ends_at`. It does **not** check whether that time is currently free (E3.11, D-04).
5. Transaction: conditional update that also sets `decided_by` and `decided_at`; audit row (`lab_booking_approved`, `lab_booking_rejected`, `lab_booking_alternative_proposed`); in-app notification for the booker. After commit, the booker's e-mail is sent (`service.ts:272`).

## 4. Assistants

`assistant_user_id` is set only by an approving head or admin. It is the sole link that gives an assistant any access to a booking:

- Console lists for an assistant are filtered `assistant_user_id = me` (`service.ts:409-428`; console passes `onlyAssignedTo` for non-managers, `lab-staff/[slug]/page.tsx:38-39`).
- Manual attendance requires either manager rights or `assistant_user_id = me` (`service.ts:370`).
- The QR roster and the QR staff-side decision apply the same rule (E3.08).

An approved booking with no assistant (possible when the lab does not require one) is visible to and actionable by heads and admins only.

## 5. Alternatives (`respondToProposal`, `service.ts:278-316`)

- The proposal is **not a hold.** While `alternative_proposed`, the row keeps its original `starts_at`/`ends_at` and keeps blocking that original slot; the proposed range is stored beside it and blocks nothing (E3.02 section 3.1; the operations guide says the same at `docs/handover/LAB-OPERATIONS-GUIDE.md:155`).
- Only the booker may answer; anyone else gets `not-found` (`service.ts:281`).
- Accept: the proposed start must be after now (`service.ts:284`); then the current hours, blackouts and capacity are re-checked with `minLeadMinutes: 0` because "the head chose the time" (`service.ts:286-290`). The single `UPDATE` sets `status='approved'`, replaces `starts_at`/`ends_at` with the proposal and clears the proposal columns. PostgreSQL evaluates the exclusion constraint against the new range at that statement; if someone took it, `23P01` is caught and reported as "That suggested time has been taken in the meantime" (`service.ts:312`).
- Decline: status becomes `cancelled`; heads are notified (`service.ts:307`).
- Not done on this path: no audit row is written for accept or decline; the heads are not notified on accept; `assistant_user_id` is not assigned, so a lab that `requires_assistant` ends up with an approved booking that has none (E3.11, D-02); the weekly-hours limit is not re-checked.

## 6. Cancellation (`service.ts:320-359`)

- Who: the booker, or a head or admin of the lab. Anyone else receives `not-found` "do not reveal it to anyone else" (`service.ts:327`). An assistant cannot cancel.
- Permitted from `requested`, `alternative_proposed`, `approved` (via `canTransition`).
- A manager must give a reason of at least 3 characters.
- The cut-off: the **booker** cannot cancel an `approved` booking when `startsAt - now < cancelCutoffMinutes` (`service.ts:332`). A manager is not subject to it. The cut-off is not applied to `requested` bookings.
- Notifications: booker cancels -> every head of the lab; manager cancels -> the booker only. The assigned assistant is not notified in either case.
- Audit: a row is written only when a manager cancels (`service.ts:350-352`); a booker's own cancellation leaves no audit row (the booking row itself and `updated_at` are the only trace).

## 7. Manual attendance (`markAttendance`, `service.ts:363-390`)

| Rule | Line |
|---|---|
| Caller must be staff of the lab (`requireStaffOfLab`: admin or any `lab_staff` row) | 368 |
| An assistant must be the assigned assistant; heads and admins may close any booking of the lab | 370 |
| Booking must be `approved` | 371 |
| Booking must have started (`startsAt <= now`); there is no upper time limit | 372 |
| `no_show` requires a reason of at least 3 characters; `attended` reason is optional | 373-374 |

`attended` moves the booking to `completed`, `no_show` to `no_show`; one transaction inserts the `lab_attendance` row (`method='manual'`, `marked_by`), and the audit row `lab_attendance_<outcome>`. The unique index makes a second recording impossible; the conditional update makes a concurrent QR check-in and a manual mark safe (E3.08 section 9).

There is no correction path in code or screens: both outcomes are terminal states (`rules.ts:155-158`) and there is no function to change an attendance row (E3.11, D-06, also recorded as a known gap in `LAB-BOOKING-DESIGN.md:168`).

## 8. What never happens automatically

No code in `src/` changes a lab booking's status on a timer; the only importers of the table outside `src/server/labs` are migrations. Consequently:

- A `requested` booking that nobody answers stays live and keeps its slot indefinitely (known gap, `LAB-BOOKING-DESIGN.md:165`). The escalation list (E3.05) shows it to administrators while its start is in the future; after the start time passes it is no longer escalated (`service.ts:492`) but still counts toward the booker's open-request limit.
- An `approved` booking nobody marks stays `approved` after its end. It is listed under "Recent history" (approved with `endsAt < now`, `service.ts:420`) and counted as "approved" but neither "attended" nor "no-show" in reports.
- There is no reminder e-mail of any kind.

## 9. Notifications and audit actions emitted

Notification types added by migration 0010: `booking_requested`, `booking_decided`, `booking_alternative`, `booking_cancelled` (`0010:7-10`). Templates are in `src/server/notifications/templates` (not reviewed in this volume).

Audit actions written by the lab code (`entity_type` `lab_booking`, `lab`, `lab_department`, `lab_device_key`, `lab_scan_event`):

| Action | Where |
|---|---|
| `lab_booking_approved`, `lab_booking_rejected`, `lab_booking_alternative_proposed` | `service.ts:262` |
| `lab_booking_cancelled` (manager only) | `service.ts:351` |
| `lab_attendance_attended`, `lab_attendance_no_show` | `service.ts:385` |
| `lab_qr_in_verified`, `lab_qr_out_verified` | `attendance-qr.ts:502` |
| `lab_qr_review_approved`, `lab_qr_review_declined` | `attendance-qr.ts:562` |
| `lab_device_key_registered`, `lab_device_key_revoked` | `attendance-qr.ts:76, 118` |
| `lab_created`, `lab_updated`, `lab_hours_set`, `lab_blackout_added`, `lab_blackout_removed`, `lab_staff_added`, `lab_staff_removed` | `manage.ts` |
| `lab_department_created`, `lab_department_updated`, `lab_department_deleted` | `department-admin.ts` |

The console's "Decision history" (`listDecisionHistory`, `service.ts:532-569`) reads `audit_logs` rows with entity type `lab_booking` for the lab, newest first, limit 30 on the screen. It therefore also lists `lab_attendance_*` and `lab_qr_*_verified` rows; the screen has labels only for the first six action names (`lab-staff/[slug]/page.tsx:49-56`), so QR rows display their raw action string.
