# E3.10 Tests, evidence, and what is unproven

No test was run while writing this volume (documentation task, no install or build). Statements about what tests prove come from reading the test files and the delivery documents. Results of any run are not reported here.

## 1. Test inventory

| File | Level | Count of cases | Needs |
|---|---|---|---|
| `src/server/labs/rules.test.ts` | unit | 5 groups | Node |
| `src/server/labs/rules-edges.test.ts` | unit | time zone, calendar, boundaries, holidays, escalation | Node |
| `src/server/labs/departments.test.ts` | unit | tree, cycle, roll-up | Node |
| `src/server/labs/http.test.ts`, `qr-http.test.ts` | unit | flag gating, status mapping | Node |
| `src/lib/lab-qr/protocol.test.ts` | unit (real WebCrypto) | encoding, tokens, `decideScan`, skew, revocation, `pairState` | Node |
| `src/lib/lab-qr/client/client.test.ts`, `session.test.ts`, `qr.test.ts` | unit (fake IndexedDB) | key lifecycle, outbox, cache, QR round trip, camera error mapping | Node |
| `src/lib/lab-qr/pwa-assets.test.ts` | unit | manifest and service worker source properties | Node |
| `tests/integration/34-lab-booking.test.ts` | integration | creation, availability, request, race, decisions, cancel, attendance, reports, screens | production build, real PostgreSQL |
| `tests/integration/44-lab-attendance-qr.test.ts` | integration and browser | keys, exchange, replay, skew, review, revocation, roster, one Playwright run | same, plus a browser engine |

## 2. What is demonstrated

| Claim | Evidence |
|---|---|
| Twenty simultaneous requests for one slot produce exactly one booking (exclusion constraint) | `34:182` |
| Touching times do not conflict; overlapping do | `34:195` |
| Exactly one of two simultaneous decisions wins, one audit row, one notice | `34:338` |
| Rules: grid, hours, blackouts, notice and horizon exact to the millisecond, IST across the UTC date line | `rules.test.ts`, `rules-edges.test.ts` |
| A head of one lab cannot manage or decide for another; assistants see only assigned bookings | `34:111, 352, 559` |
| Report figures equal a direct row count; heads see only their labs; formula-looking names neutralised | `34:464, 489, 503` |
| Flag off means every lab and QR route answers 404 and the handler does not run | `http.test.ts:12`, `qr-http.test.ts:15`, integration |
| Pass, desk code and scan event round trip; tampering, wrong type, over-long, extra fields refused | `protocol.test.ts:88-136` |
| Forgery by unregistered key, mismatched key id, assistant holding only own key, other student, other booking, wrong lab, wrong action, non-staff, unassigned assistant | `protocol.test.ts:174-243` |
| Expired step; exactly one step of drift accepted | `protocol.test.ts:165, 253` |
| An online event is judged against the server clock whatever the batch time claims; an offline event dated after its batch is refused correction | `protocol.test.ts:345-368` |
| Revoked key refused from the revocation time on; earlier scans arriving late go to review | `protocol.test.ts:371-387` |
| Two halves arriving together give one verified check and one attendance row; 40 events sent twice in parallel are stored once | `44:308, 320` |
| Manual attendance is not overwritten by a QR check-in | `44:239` |
| A scan with a far-off clock is held; only a head may decide it; a decline never counts | `44:334-376` |
| Outbox: batching, retry, no early "verified", signed-out stop, stale warning | `client.test.ts:64-138` |
| Roster cache expiry, per-user privacy, wipe on user change | `session.test.ts`, `client.test.ts:46-62` |
| JavaScript QR decode of real tokens; non-extractable key handle survives IndexedDB reopen | `qr.test.ts:12-31, 74` |
| In a desktop browser engine: pass appears, no serious accessibility violation, shell reloads offline, an offline scan is held as not verified, sent when back online; staff tab absent for a member | `44:440-540` |

## 3. What is not demonstrated

Taken from `LAB-DEVICE-TEST-PROTOCOL.md:70-85` (U1 to U12) and from this review.

| # | Claim | Why it is open |
|---|---|---|
| U1 | Keys and the outbox persist for a week in Safari and in an installed iOS web app; survive storage pressure | iOS eviction policy is a property of the OS; the fake IndexedDB has none |
| U2, U3 | JavaScript decoder reads a pass from a real screen, distance, lighting, glare; native detector used where present | Tests decode a clean raster |
| U4 | Camera prompt, denial and recovery on iOS Safari, Samsung Internet, installed PWA | Needs real permission UI |
| U5 | Install prompt, Add to Home Screen, maskable icon | Needs install UI |
| U6 | Service worker serves the shell offline on a phone | Only desktop Playwright has run it |
| U7 | Background Sync fires on Chrome and Samsung Internet; iOS relies on open and online | Needs the browser scheduler |
| U8 | Two-way exchange under 15 seconds per student at a real desk | Human workflow |
| U9 | Real phone skew is within the step tolerance often enough; 5 minute review threshold is right | Needs a 20 device sample |
| U10 | Screen reader and large text complete both screens | Automated axe is not a substitute |
| U11 | The CSP and camera permission header do not break camera or worker in iOS WebKit | Header strings are tested, behaviour is not |
| U12 | Battery, heat and memory of continuous decoding on an older iPhone | Hardware |
| - | Concurrency of the service worker flush and the page flush on one outbox | Both send the same events; the server is idempotent, but no test exercises the two together |
| - | The check-out path through the assistant roster after a verified check-in | Predicted to fail from reading the code (E3.11 D-13); the integration test submits events directly |
| - | Rate limit behaviour of the pass screen's 5 second poll over hours | Computed, not measured (E3.11 D-09) |
| - | A head acting on held scans, listing and revoking keys | No screen exists; only API calls |

## 4. State of sign-off

- `FEATURE_LAB_BOOKING` and `FEATURE_LAB_ATTENDANCE_QR` are off by default and both must be exactly `true` for QR (`features.ts:14-26`).
- The threat model is "NOT SIGNED OFF"; its decision record marks the assurance level and the acceptance of live relay (T2) as needing KIIT and a lab head (`LAB-ATTENDANCE-THREAT-MODEL.md:5, 79-91`).
- The device protocol results table is blank (`LAB-DEVICE-TEST-PROTOCOL.md:3`).
- The lab-head review packet's record table is blank (`LAB-HEAD-REVIEW-PACKET.md:124-130`). The packet still says "nothing here has been built yet" (line 95); that sentence is out of date relative to the code.
- Lab policy values are recommended defaults from HD-16, not an approved policy (`labs.ts:10-11`).

Enabling either flag in an environment real people use is therefore a decision the documents explicitly reserve for people. This volume describes the code; it does not claim the system is ready.

## 5. Running order the project's own documents recommend

`LAB-DEVICE-TEST-PROTOCOL.md:87-92`: U6 and U2 on one Android phone first; then the older iPhone (T1, T2 to start the 7 day clock, T4, T5); then T9 with two real people, then T10 and T11 with payloads captured from the network panel; file evidence under `docs/delivery/EVIDENCE/lab-devices/`.
