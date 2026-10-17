# Volume E3: laboratory platform and QR attendance (engineering reference)

Part of the KNEST handover pack, engineering reference. Describes the code on `codex/production-v1` at commit `383abf9`. Documentation only; no code was changed and no test or build was run while writing it.

## Read this first

- Lab booking is behind `FEATURE_LAB_BOOKING`; QR attendance, the PWA and camera scanning are behind `FEATURE_LAB_ATTENDANCE_QR`, which also needs the first. **Both are off by default** (`src/server/features.ts`).
- The QR threat model is **not signed off**, the real-device test protocol has **no results**, and lab policy values are recommended defaults, not approved policy. Anything about phones, iOS, cameras, storage eviction or the offline shell on a real device is **unproven**.
- Assurance level is "record attendance". Nothing opens a door.
- Statements cite `file:line`. "Not determined from the code" marks what could not be answered from the repository.

## Files

| # | File | Contents |
|---|---|---|
| 01 | `01-overview-flags-and-http.md` | Layers, flags, `labRoute` and `qrRoute`, rate limits, API and screen inventory |
| 02 | `02-data-model-and-exclusion-constraint.md` | Tables, constraints, migrations 0010, 0012, 0013, the no-overlap exclusion constraint, replay indexes |
| 03 | `03-registry-hours-blackouts-slots.md` | Lab creation and settings, hours, blackouts, IST time, slot engine, request validation, limits |
| 04 | `04-booking-lifecycle.md` | State machine and transitions, concurrency, decisions, alternatives, cancellation, manual attendance, audit |
| 05 | `05-roles-console-and-visibility.md` | Roles, capability matrix, head console, assistant roster and visibility, escalation |
| 06 | `06-departments-and-reporting.md` | Department hierarchy, roll-up, utilisation report SQL, CSV |
| 07 | `07-qr-protocol-wire-format.md` | Keys, token bytes, payload schemas, domain separation, registration proof, crypto limits |
| 08 | `08-qr-exchange-decisions-and-review.md` | Two-way exchange, decision order, clock skew, replay, pairing, revocation, review queue |
| 09 | `09-device-app-pwa-offline-and-camera.md` | Device storage, outbox and sync, service worker caching, manifest, camera, iOS limits |
| 10 | `10-tests-evidence-and-what-is-unproven.md` | What tests demonstrate, what is open, sign-off state |
| 11 | `11-defects-gaps-and-not-determined.md` | Defects with file and line, outdated documents, not determined |

## Source map

| Area | Path |
|---|---|
| Booking rules (pure) | `src/server/labs/rules.ts`, `departments.ts` |
| Booking services | `src/server/labs/service.ts`, `manage.ts`, `department-admin.ts`, `reports.ts`, `access.ts` |
| QR server | `src/server/labs/attendance-qr.ts`, `qr-http.ts` |
| QR protocol | `src/lib/lab-qr/{constants,encoding,keys,tokens,decide}.ts` |
| QR device client | `src/lib/lab-qr/client/*`, `src/app/lab-device/*` |
| PWA | `public/sw.js`, `public/manifest.webmanifest`, `public/offline.html` |
| Schema | `src/db/schema/labs.ts`, `lab-attendance-qr.ts`; migrations `0010`, `0012`, `0013` |
| Routes | `src/app/api/labs/**`, `api/lab-attendance/**`, `api/admin/labs`, `api/admin/lab-departments` |
| Delivery documents | `docs/delivery/LAB-BOOKING-DESIGN.md`, `LAB-ATTENDANCE-THREAT-MODEL.md`, `LAB-DEVICE-TEST-PROTOCOL.md`, `LAB-HEAD-REVIEW-PACKET.md`; `docs/handover/LAB-OPERATIONS-GUIDE.md` (non-technical) |

## The five facts to remember

1. Double booking is prevented by a PostgreSQL exclusion constraint, one live booking per lab at a time regardless of capacity (E3.02).
2. All time logic is IST and pure; the server re-checks everything the screen checks (E3.03).
3. Every status change is a conditional update with its audit row and notice in one transaction (E3.04).
4. In QR attendance the device only reports; the server decides, and "verified" needs both a staff-side and a student-side accepted event within 2 minutes (E3.08).
5. Several gaps still block turning QR on in practice even after sign-off: no screen for held scans or keys, and key-lifecycle dead ends (E3.11 D-05, D-12). The checkout roster and closed-lab recovery defects were repaired in the 2026-10-17 continuation candidate; see the follow-up in E3.11.
