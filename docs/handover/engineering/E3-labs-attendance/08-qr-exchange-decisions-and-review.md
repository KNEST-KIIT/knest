# E3.08 QR attendance: the two-way exchange, server decisions, replay, clock skew and review

Sources: `src/lib/lab-qr/decide.ts`, `src/server/labs/attendance-qr.ts`, `src/lib/lab-qr/constants.ts`, tests `protocol.test.ts:144-409`, `tests/integration/44-lab-attendance-qr.test.ts`.

The device only reports; the server decides (`decide.ts:21`). `decideScan` is a pure function over injected lookups; `dbLookups` supplies them (`attendance-qr.ts:132-153`).

## 1. The exchange, step by step

Participants: the student device (S), the assistant device (A), the server.

1. S shows a **pass** for one booking and one action, re-signed at every 30 s boundary (`pass-panel.tsx:49-75`).
2. A scans it (camera or pasted text). Locally, as a courtesy (`flows.ts:7-12, 33-61`): parse; booking is on the cached roster; the signing key id is one of that student's cached keys; signature verifies; step within one of now; action matches A's selected mode. A then signs a `scan` event with `sd: "staff"`, embedding the pass, and queues it in its outbox.
3. A's screen shows a **desk challenge** for the lab and mode, re-signed every 30 s (`scan-panel.tsx:291-311`).
4. S scans the challenge. Locally (`flows.ts:66-92`): lab id equals the booking's lab; signature verifies against the lab staff public keys S cached with its pass list; step; mode matches the chosen action. S signs a `scan` event with `sd: "student"` and queues it.
5. Both devices send their outboxes whenever they can. Each event is decided **independently and in any order**. A check becomes `verified` when the server has **accepted** a staff event and a student event for the same booking and action whose corrected times are within 2 minutes of each other (`PAIR_WINDOW_MS`).

The interface never shows "verified" before the server says so: the status text is driven by the `checks` returned by the server (`pass-panel.tsx:140-145`, `outbox.ts:86`).

## 2. Constants (`constants.ts`)

| Constant | Value | Role |
|---|---|---|
| `STEP_SECONDS` | 30 | pass and challenge step |
| `STEP_TOLERANCE` | 1 step | accepted drift |
| `MAX_CLOCK_SKEW_MS` | 5 min | offline correction above this goes to review; also the registration proof window |
| `ONLINE_TOLERANCE_MS` | 2 min | an online event's own scan time must be this close to the server clock |
| `MAX_SYNC_DELAY_MS` | 24 h | events older than this at arrival go to review |
| `CLIENT_FUTURE_SLOP_MS` | 5 s | an offline event cannot be later than the batch time it came in |
| `MAX_FUTURE_MS` | 60 s | corrected time may not be this far ahead of the server |
| `EARLY_GRACE_MS`, `LATE_GRACE_MS` | 15 min each | scan must fall inside the slot widened by these |
| `PAIR_WINDOW_MS` | 2 min | both halves must be this close |
| `ROSTER_CACHE_TTL_MS` | 24 h | device cache lifetime |
| `UNSYNCED_WARN_MS` | 1 h | warning on the scanning device |
| `MAX_TOKEN_LENGTH`, `MAX_BATCH_EVENTS` | 2048, 50 | parse limits |

All are proposals, not approved policy (`constants.ts:3-6`).

## 3. The decision function (`decideScan`, `decide.ts:96-194`)

Ordered. The first failing step ends the decision. Reject codes (`decide.ts:45-60`) are listed with the step that raises them.

| Step | Check | Outcome on failure |
|---|---|---|
| 1 | Outer `scan` token parses and verifies against the scanner's registered key | `malformed`, `unknown-key`, `bad-signature` |
| 1b | Scanner key's owner equals the signed-in submitter | `not-your-key` |
| 2 | Inner token is a `pass` (if `sd = staff`) or `chal` (if `sd = student`) and verifies against a registered key | `malformed`, `unknown-key`, `bad-signature` |
| 3 | Booking exists | `booking-not-found` |
| 3 staff | pass `b` equals the booking; pass action equals event action; pass key's owner is the booker; scanner has a role in the lab; an assistant must be the booking's assigned assistant | `wrong-booking`, `wrong-action`, `not-the-booker`, `not-staff`, `not-assigned` |
| 3 student | challenge `l` equals the booking's lab; mode equals action; scanner is the booker; the challenge signer has a role in the lab, and an assistant must be the assigned one | `wrong-lab`, `wrong-action`, `not-the-booker`, `not-staff`, `not-assigned` |
| 4 | Time correction (section 4), then pass or challenge step within tolerance of the corrected time | `expired` |
| 5 | Corrected time within `[start - 15 min, end + 15 min]` | `outside-slot` |
| 6 | Key revocation (section 7) | `key-revoked` (reject) or `key-revoked-before-sync` (review) |
| 6b | Booking status must be `approved` or `completed`; `no_show` goes to review; any other status | `booking-not-attendable` (reject) or `booking-state` (review) |
| 7 | Review conditions (below) | `clock-skew`, `future-dated`, `late-sync` |
| 8 | Otherwise | `accepted` |

Lab role comes from `labRole`: lab administrators resolve to `admin` and may scan any booking; otherwise the `lab_staff` row; deactivated accounts resolve to nothing and their keys never resolve (`attendance-qr.ts:126-153`).

Two consequences of the role rules:

- A head may scan any booking of the lab; an assistant only assigned ones, matching manual attendance (`protocol.test.ts:157`).
- The decision never compares the scanner's identity to the booker's on the **staff** side. A person who is both a staff member of the lab and the booker of an approved booking they are assigned to (or who is head or admin) can satisfy both halves alone, including from one device by pasting their own pass text (D-11). Manual attendance has the same property for heads (`service.ts:370`). No test covers it.

## 4. Clock skew and the online/offline flag (`decide.ts:146-154, 187-191`)

The scan event carries `at` (device clock at scan) and `ol` (signed: 1 offline). The batch carries `clientNowMs` (device clock at send; **not signed**, chosen by the submitter).

```
offline (ol = 1):  skew = clientNowMs - serverNowMs
                   effective = at - skew
online  (ol = 0):  skew = at - serverNowMs
                   effective = at
```

Why two formulas: the batch time is unsigned, so letting it correct an event the device calls "online" would let a submitter pick the time its scan is judged against. An online event is held to the server clock instead and only corrected if it is declared offline (`decide.ts:147-148`, test `protocol.test.ts:345`).

Review conditions evaluated after the hard checks:

| Code | Condition |
|---|---|
| `clock-skew` | offline: `abs(skew) > 5 min`; online: `abs(skew) > 2 min` |
| `future-dated` | offline and `at - clientNowMs > 5 s`; or `effective - serverNow > 60 s` |
| `late-sync` | `serverNow - effective > 24 h` |

The tests pin the boundaries: exactly the tolerance is accepted, one millisecond more goes to review (`protocol.test.ts:311`).

What bounds a dishonest device. An offline-claiming submitter controls both `at` and `clientNowMs`, so within the review gates it can place `effective` anywhere from 24 hours before the server clock up to 5 s ahead. What stops this being a free forgery is the **step check at step 4**: the effective time must sit within one step of the step inside the *pass* (or challenge), which the *other* party's device signed from its own clock when the code was shown. A student's pass for step `s` cannot be validated for a time far from `s`. Forgery therefore needs a cooperating counterpart or a pre-generated pass; the model records insider collusion as T7 and does not claim to stop it. The client-side clock is trusted to the 5 minute review threshold, which the threat model lists as needing the 20 device sample (`LAB-DEVICE-TEST-PROTOCOL.md:28`).

## 5. Intake, idempotency and replay (`attendance-qr.ts:370-468`)

`submitScanBatch`: `clientNowMs` must be a positive safe integer; `events` is an array of 1 to 50 strings. Each event is processed on its own; "one bad event never blocks the rest" (`attendance-qr.ts:366-369`).

`processEvent`:

1. Parse the outer token with `parseToken(..., 'scan')`. Unparseable: `rejected/malformed`, id null, nothing stored.
2. **Idempotency.** If an event with that `id` already exists: when it belongs to another user, `rejected/not-your-key, duplicate`; otherwise return the stored status, code and, if accepted, the current check state, `duplicate: true`, without changing anything. This is what makes retrying an outbox safe.
3. `decideScan` with `serverNowMs = now` and the batch's `clientNowMs`.
4. `persist`:
   - **Untrusted rejections are not stored:** `malformed`, `unknown-key`, `bad-signature`, `not-your-key` (`attendance-qr.ts:358, 417-419`). Why: if anyone who saw an event token could submit a mutated copy and have it stored under the same id, they would use up that id and the real event would be refused as a duplicate.
   - If the booking does not exist, nothing is stored (foreign key).
   - Otherwise the event is stored with its status, code and corrected time.
5. Transaction: lock the booking row `FOR UPDATE` ("so two simultaneous halves of one exchange pair exactly once", line 448); insert the event with `ON CONFLICT (id) DO NOTHING`; if it was a duplicate id, return the stored answer; if the decision was `accepted`, run `pairAndRecord`.
6. **Replay by nonce:** a unique-index violation (`23505`) on the staff or student nonce index means the pass or challenge nonce was already used by a live event. The transaction rolls back, a `rejected` row with code `replay` is inserted (with null inner key and nonce so it does not occupy the index), and the answer is `rejected/replay` (`attendance-qr.ts:459-467`).

What each replay defence stops:

| Attack | Stopped by |
|---|---|
| Same event token submitted twice | event `id` primary key (step 2) |
| Same pass presented in a second event (new id) | staff nonce index |
| Captured event submitted by another account | `not-your-key` (scanner key must belong to the submitter) |
| Same desk code scanned twice by one student | student nonce index |
| A pass photographed and shown after its window | `expired` (step 4) |

Not stopped: two different students scanning one desk challenge (allowed by design, a challenge is lab-wide); an assistant presenting a student's live pass text to their own device within the window (that is the live relay of T2).

## 6. Pairing and the attendance row (`pairAndRecord`, `attendance-qr.ts:473-515`; `pickPair`, `decide.ts:202-210`)

After an accepted event, all accepted events of that booking and action are read. `pickPair` takes the earliest staff event and student event whose `effectiveAt` differ by at most 2 minutes. Then:

- A `lab_qr_checks` row for `(booking, action)` is upserted. State is `verified` if a pair exists, `partial_staff` if only staff events exist, otherwise `partial_student`. When both kinds exist but are more than 2 minutes apart the stored state is `partial_student` (the label is a convenience; both event ids are stored). Once a check is `verified` it is returned unchanged and never recomputed (line 484).
- On a pair: audit `lab_qr_<action>_verified` (the actor is the submitter of the event that completed the pair).
- For `in`: `UPDATE lab_bookings SET status = 'completed' WHERE status = 'approved'`; if a row changed, insert `lab_attendance (outcome attended, method qr, marked_by null)` with `ON CONFLICT DO NOTHING`. A booking already `completed` by a manual mark is left alone, and the existing manual row is never overwritten (test `44:239`).
- For `out`: nothing changes on the booking. The check is recorded and nothing else reads it.

Either order of arrival works; two halves arriving at the same instant produce one check and one attendance row because of the booking row lock (test `44:308`).

## 7. Key revocation (`decide.ts:159-179`, `attendance-qr.ts:91-122`)

Both the scanner key and the inner key are examined. For a key with `revokedAt`:

- `effective >= revokedAt`: reject `key-revoked`.
- `effective < revokedAt` (the scan happened before revocation but is arriving now): **review** `key-revoked-before-sync`, "because a thief can also claim an old time".

Who may revoke: the owner; any lab administrator; or a head of a lab in which the key's owner has **any** booking (`attendance-qr.ts:96-107`). A non-owner must give a reason of at least 3 characters. Revocation is idempotent. Revoked keys cannot be re-registered (`attendance-qr.ts:64`), so the device must create a new key; see D-05 and D-12 for what the screens do and do not support.

Note the head's authority is broader than the threat model's wording "head can revoke a booking's key": it covers any key of any person with any booking, past or future, in the head's lab.

## 8. The head review queue (`attendance-qr.ts:519-567`)

- `listReviewQueue(labId)`: heads and admins; events in `review` for bookings of that lab, oldest first, limit 200; returns student display name, times, code. No e-mail.
- `decideReview(eventId, approve, note)`: head or admin of the booking's lab; note 3 to 300 characters. Inside a transaction with the booking row locked, a conditional update from `review` to `accepted` (code kept) or `rejected` (code `review-declined`) with reviewer and note; audit `lab_qr_review_approved` or `_declined`; on approval `pairAndRecord` runs, so an approval can complete a pair. A second decision on the same event returns `conflict`.
- A declined event becomes `rejected` and so leaves the nonce index.

Behaviours to know:

- Approval does not re-run the decision. It does not re-check revocation, slot or booking status at approval time.
- An approved held scan for a booking in `no_show` (code `booking-state`) can produce a `verified` check, but the booking stays `no_show` and no attendance row is written, because the conditional update requires `approved`. The code comment says this is deliberate: a `no_show` "is a head decision a late scan must not silently undo" (`decide.ts:93`).
- **There is no screen for the queue.** No component in `src/app` calls `/api/lab-attendance/reviews`. The pass screen tells a student "One scan is waiting for the lab head to review it" (`pass-panel.tsx:203`) and the booking-level `reviewPending` flag is exposed, but a head can act only through the API (D-05).

## 9. Interaction with manual attendance

- `markAttendance` and the QR path both close a booking with a conditional `WHERE status = 'approved'` update, and `lab_attendance` is unique per booking. Whichever commits first wins; the other sees zero rows and does not insert.
- After a manual `attended`, QR scans are still accepted (`completed` is attendable) and can produce a verified check, but add no row.
- After a manual `no_show`, new scans go to review `booking-state`.
- Reports cannot tell a QR row from a manual one except through `method` (E3.06 section 4.2).

## 10. Roster and pass data served to devices

| Endpoint | Content | Scope rules | Code |
|---|---|---|---|
| `roster` | approved bookings that start within 24 h or ended within the last hour; student display name; the student's active public keys; check summary; up to 300 | admin: all; head: own labs; assistant: assigned only; member: 403 | `attendance-qr.ts:231-274` |
| `passes` | the booker's own `approved` or `completed` bookings in the same window, up to 20, with the active public keys of every head and assistant of the lab | own bookings only | `300-331` |
| `bookings/[id]/checks` | `{in, out, reviewPending}` states | booker; admin; head; assigned assistant | `333-343` |
| `me` | user id, display name, whether they run any lab | self | `277-283` |

Public keys are sent so a device can verify the other party's code offline. A student device therefore receives the public keys of **all** staff of the lab, not only the assigned assistant; the local check proves "a lab staff member signed this", and the server enforces assignment.

**The roster excludes `completed` bookings** (`attendance-qr.ts:239`, `eq(status, 'approved')`) while a verified check-in sets the booking to `completed` (`attendance-qr.ts:507`). After the assistant's device refreshes its roster following a check-in, the booking is no longer on it, and the local check in `scanStudentPass` answers `not-on-roster` for the check-out pass (`flows.ts:47-48`). The server would accept the check-out (`ATTENDABLE` includes `completed`, `decide.ts:94`). The integration test sends check-out events directly and does not exercise the roster (`44:226`). See D-13. Not run on a device.
