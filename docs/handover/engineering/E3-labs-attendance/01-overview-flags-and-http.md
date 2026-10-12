# E3.01 Overview, feature flags and the HTTP layer

This volume documents the laboratory platform as it exists in the repository on branch `codex/production-v1` (commit `383abf9` at the time of writing). Every statement cites the file and line range it was read from. Where the code does not answer a question, the text says "not determined from the code".

## 1. Status in one paragraph

Lab booking exists in code but is off unless `FEATURE_LAB_BOOKING` is exactly the string `true` (`src/server/features.ts:14-16`). QR attendance, the PWA and the camera scanner are off unless `FEATURE_LAB_ATTENDANCE_QR` is exactly `true` **and** lab booking is on (`src/server/features.ts:24-26`). Both are off by default. The QR threat model is recorded as "NOT SIGNED OFF" (`docs/delivery/LAB-ATTENDANCE-THREAT-MODEL.md:5`), and the real-device protocol has no results (`docs/delivery/LAB-DEVICE-TEST-PROTOCOL.md:3`). Everything written about browser and phone behaviour in this volume that is not demonstrated by a unit test or the Playwright test in `tests/integration/44-lab-attendance-qr.test.ts` is **unproven on real devices**. Section 10 lists the specific claims.

The assurance level built is "record attendance": the code records who was in a lab during a slot; nothing in it opens a door (`src/db/schema/lab-attendance-qr.ts:9-10`, threat model line 7).

## 2. Layers

| Layer | Files | Property |
|---|---|---|
| Pure rules (no database, no clock of their own) | `src/server/labs/rules.ts`, `src/server/labs/departments.ts`, `src/lib/lab-qr/decide.ts`, `src/lib/lab-qr/tokens.ts`, `src/lib/lab-qr/keys.ts`, `src/lib/lab-qr/encoding.ts`, `src/lib/lab-qr/constants.ts` | Exhaustively unit tested; policy comes in as arguments |
| Database services | `src/server/labs/service.ts` (booking lifecycle), `manage.ts` (lab settings and staff), `department-admin.ts`, `reports.ts`, `attendance-qr.ts` (QR), `access.ts` (roles) | Transactions, audit rows, notifications |
| HTTP wrappers | `src/server/labs/http.ts` (booking routes), `src/server/labs/qr-http.ts` (QR routes) | Flag gate, rate limit, error mapping |
| Routes | `src/app/api/labs/**`, `src/app/api/lab-attendance/**`, `src/app/api/admin/labs`, `src/app/api/admin/lab-departments` | Thin: parse, call a service |
| Screens | `src/app/(member)/dashboard/lab-booking/**`, `src/app/(member)/dashboard/lab-staff/**`, `src/app/(staff)/admin/labs/**`, `src/app/lab-device/**` | Server components; `lab-device` is a client app |
| Device client | `src/lib/lab-qr/client/**`, `public/sw.js`, `public/manifest.webmanifest`, `public/offline.html` | Runs in the browser, works offline |

Design rule worth knowing before reading the rest: the server decides, the device only reports. The services re-check every rule the screens also check (`src/server/labs/service.ts:108`, `src/lib/lab-qr/decide.ts:21`).

## 3. The two HTTP wrappers

### 3.1 `labRoute` (booking, management, reports)

`src/server/labs/http.ts:19-35`:

1. If `isLabBookingEnabled()` is false the route answers `404 {"error":"Not found."}` without running the handler. A caller cannot tell the route exists.
2. Otherwise, unless `limit` is `null`, `limitByUser(limit)` runs. The default bucket is `labAction`; the availability route passes `labAvailability`. An anonymous caller is let through to the route's own 401 (`src/server/security/route-limits.ts:19-24` returns null when there is no session).
3. The handler runs. An `UnauthorizedError` becomes 401 `Sign in to continue.` or 403 `Not permitted.`; anything else is rethrown.

`respond()` (`http.ts:7-13`) maps service result codes to statuses:

| Code | Status | Meaning in the services |
|---|---|---|
| `closed` | 404 | Booking flag is off |
| `ineligible` | 403 | Account inactive, e-mail unverified, or profile unfinished |
| `invalid` | 400 | A rule or validation failed |
| `limit` | 409 | A per-person limit was reached |
| `conflict` | 409 | Overlap (database exclusion constraint) |
| `not-found` | 404 | Also used to hide a booking from someone who may not see it |
| `state` | 409 | Wrong state, or a concurrent decision won |
| `forbidden` | 403 | Role check inside a service |

### 3.2 `qrRoute` (QR attendance)

`src/server/labs/qr-http.ts:20-32` is the same shape with two differences: the gate is `isLabAttendanceQrEnabled()` (both flags), and the limiter is always `labScan`. Every response, including errors, carries `cache-control: no-store` (`qr-http.ts:9-14`, `21`, `28`). Its code map is `{closed:404, invalid:400, not-found:404, forbidden:403, conflict:409, limit:409}` (`qr-http.ts:7`).

Note that the manual attendance route used from the scan screen (`/api/labs/bookings/[id]/attendance`) goes through `labRoute`, so it is gated by the booking flag only.

## 4. Rate limits that apply

Values from `src/server/security/rate-limit.ts:35-44`. Each is a token bucket keyed `<name>:<userId>`; "refill interval" is the time to refill a drained bucket.

| Bucket | Capacity | Refill | Used by |
|---|---|---|---|
| `labRequest` | 20 | 1 h | `POST /api/labs/[slug]/request` |
| `labAction` | 120 | 1 h | every other `labRoute` handler (decide, cancel, respond, attendance, manage, report CSV, admin lab and department routes) |
| `labAvailability` | 240 | 1 h | `GET /api/labs/[slug]/availability` |
| `labScan` | 600 | 1 h | every `/api/lab-attendance/*` route, shared |

The request route additionally runs the Turnstile check (`src/app/api/labs/[slug]/request/route.ts:14-15`). Interaction between `labScan` and the pass screen's polling is a finding (E3.11, D-09).

State-changing requests also pass the global edge guard (`src/server/security/edge-guard.ts:74-86`): a request whose `Origin` is not an allowed origin is refused with 403, and a write with no `Origin` and `Sec-Fetch-Site: cross-site` is refused. The service worker and the page send same-origin requests, so they pass. This guard is outside this volume's scope beyond that fact.

## 5. API inventory

| Route | Method | Handler | Who may succeed |
|---|---|---|---|
| `/api/labs/[slug]/availability` | GET | `getAvailability` | any signed-in user |
| `/api/labs/[slug]/request` | POST | `requestBooking` | signed-in, eligible member |
| `/api/labs/[slug]/manage` | POST `{action}` | `updateLab`, `setLabHours`, `addBlackout`, `removeBlackout`, `addLabStaff`, `removeLabStaff` | lab head, lab admin; some actions admin only |
| `/api/labs/bookings/[id]/decide` | POST | `decideBooking` | head or admin of that lab |
| `/api/labs/bookings/[id]/respond` | POST | `respondToProposal` | the booker |
| `/api/labs/bookings/[id]/cancel` | POST | `cancelBooking` | the booker, or head or admin |
| `/api/labs/bookings/[id]/attendance` | POST | `markAttendance` | assigned assistant, head, admin |
| `/api/labs/report.csv` | GET | `labReport` + `reportToCsv` | admin (all labs), head (own labs) |
| `/api/admin/labs` | POST | `createLab` | lab admin |
| `/api/admin/lab-departments` | POST `{action}` | create, update, delete department | lab admin |
| `/api/lab-attendance/me` | GET | `getMe` | signed-in |
| `/api/lab-attendance/keys` | GET, POST | `listMyDeviceKeys`, `registerDeviceKey` | signed-in |
| `/api/lab-attendance/keys/[id]/revoke` | POST | `revokeDeviceKey` | owner, admin, or head of a lab where the owner has a booking |
| `/api/lab-attendance/roster` | GET | `getRoster` | staff of a lab or admin |
| `/api/lab-attendance/passes` | GET | `listMyPasses` | signed-in (own bookings) |
| `/api/lab-attendance/bookings/[id]/pass` | GET | `getPassContext` | the booker |
| `/api/lab-attendance/bookings/[id]/checks` | GET | `getBookingChecks` | booker, head, admin, assigned assistant |
| `/api/lab-attendance/scans` | POST | `submitScanBatch` | signed-in submitter of own events |
| `/api/lab-attendance/reviews` | GET `?labId=` | `listReviewQueue` | head or admin of that lab |
| `/api/lab-attendance/reviews/[id]` | POST | `decideReview` | head or admin of that lab |

Observation: `/api/lab-attendance/bookings/[id]/pass` and `GET /api/lab-attendance/keys` have no caller in `src/app` or `src/lib` (searched with grep for the path strings). The device uses `passes` instead. `/api/lab-attendance/reviews*` and `/keys/[id]/revoke` also have no caller in the UI code (finding D-05).

## 6. Screens

| Path | File | Visible when |
|---|---|---|
| `/dashboard/lab-booking` | `src/app/(member)/dashboard/lab-booking/page.tsx` | booking flag on; onboarded user; shows a "Lab pass" link only when the QR flag is on (lines 54-66) |
| `/dashboard/lab-booking/[slug]` | `.../[slug]/page.tsx`, `booking-picker.tsx` | booking flag on; lab active |
| `/dashboard/lab-staff` | `src/app/(member)/dashboard/lab-staff/page.tsx` | admin or any `lab_staff` row; otherwise 404 (lines 21-22) |
| `/dashboard/lab-staff/[slug]` | `.../[slug]/page.tsx` guarded by `layout.tsx` | staff of that lab or admin; real 404 for others (`layout.tsx:14-17`) |
| `/dashboard/lab-staff/[slug]/report` | `.../report/page.tsx` | head or admin (`canManage`, line 22) |
| `/admin/labs`, `/admin/labs/report` | `src/app/(staff)/admin/labs/**` | staff console, area check outside this volume |
| `/lab-device` | `src/app/lab-device/page.tsx` | QR flag on, else `notFound()` (line 25); public, no auth required to load |

The shell page `/lab-device` is deliberately public and personal-data-free so the service worker can cache it (`src/app/lab-device/page.tsx:6-10`). It is rendered per request (`dynamic = 'force-dynamic'`, line 11) so the flag is read at runtime.
