# 14. Tests and coverage map

Two layers exist for E2 scope. This documentation did not run either; statements describe what the tests assert, not that they currently pass.

- **Unit tests** (Vitest) next to the source; no database or network.
- **Integration tests** in `tests/integration/` that need a running built application, Postgres, an S3 stub, an SMTP stub and a Turnstile stub (`tests/support/`). They drive real HTTP.

## 1. Unit tests

| File | Subject | What it asserts |
|---|---|---|
| `src/server/applications/availability.test.ts` | `closedReason` | open with no deadline is null; before deadline null; after deadline names the date ("11 October 2026"); `closed`, `opening_soon`, `in_progress` refuse |
| `src/server/applications/transitions.test.ts` | transition table | draft to submitted legal; no skipping to a decision; nothing moves toward draft; accepted and rejected terminal; waitlisted to accepted or rejected only; every non-terminal has a next; no self transition |
| `src/server/applications/validation.test.ts` | `findSubmissionProblem` | complete draft passes; missing required reported in question order; missing required file; optional not insisted on; stale answers rejected (too long, removed option, bad multiselect value); optional answer given is validated; wrong types rejected, not coerced; answers for deleted questions ignored; empty question set submittable |
| `src/server/storage/storage-key.test.ts` | `generateStorageKey` | dated hex key, sanitised extension |
| `src/server/storage/reconcile.test.ts` | `planReconciliation` | only old unreferenced objects flagged; media and foreign keys ignored; missing rows reported; refuses on empty table beside populated bucket; refuses when more than half orphaned |
| `src/server/onboarding/recommend.test.ts` | `recommend` | totality over role x stage; mentor/investor/partner independent of stage; stage mapping; null stage; six paths reached |
| `src/server/onboarding/destination.test.ts` | `pathHref`, `onboardingReturnPath`, `completionDestination`, `onboardingUrl` | existing pages only; hostile and looping return paths dropped; precedence |
| `src/server/audit/snapshot.test.ts` | `summariseSnapshot` | dash for missing; scalars; nested JSON; truncation |
| `src/server/analytics/client-events.test.ts` | allow-list and sanitising | one allowed event; business events rejected; malformed bodies; caps |
| `src/server/analytics/reconcile.test.ts` | `reconcileFunnel` | match, missing, removed, ordering |
| `src/app/api/analytics/track/route.test.ts` | the route with mocks | records allowed event; forged outcome refused; invalid JSON; 204 when limited and when limiter fails; 413 |
| `src/server/content/lists.test.ts` | 11 list readers, homepage | empty gives `[]`; failure throws; passthrough; always `overrideAccess: false`; homepage fallback and copy rules |
| `src/server/content/ecosystem-groups.test.ts` | `visibleCount`, `buildEcosystemGroups` | zeros hidden; empty groups dropped |
| `src/lib/search-query-log.test.ts`, `pagination.test.ts`, `safe-next.test.ts`, `ics.test.ts` | shared helpers used here | per their names |
| `src/payload/access.test.ts` | CMS access functions | outside this volume's detail |

## 2. Integration tests relevant to E2

| File | Scenarios |
|---|---|
| `01-server-action-boundary.test.ts` | None of the E2 service functions appear in the compiled Server Action manifest |
| `05-empty-cms.test.ts` | Empty database: honest empty states, spec copy on the homepage, publishing makes content appear |
| `10-anonymous-api.test.ts:119` | Unpublished program invisible to anonymous callers |
| `24-last-admin-concurrency.test.ts` | Two super admins removing each other concurrently, both by role and by deactivation: exactly one succeeds, one stays |
| `25-account-deactivation.test.ts` | Deactivation kills a live session on the next request; cannot sign in while deactivated, reactivation does not resurrect; removal from `/admin` and the Payload API; role change revokes sessions and is audited; null role removes staff access; who may do this; no self-change; strict input |
| `26-concurrency.test.ts` | Event capacity never oversold; idempotent including when full; past and external events refused; exactly one of two reviewers wins with one audit row and one notice; note bounded and typed; nothing written after submit; unpublished program does not break an existing application and staff can still review; questions frozen at submit; program with applications cannot be deleted; viewing apply page creates nothing |
| `27-document-upload.test.ts` | Unknown question stores nothing; replacement deletes the old object; real PDF round trip with headers and audit row; spoofed bytes refused; exactly 10 MB accepted; over 10 MB refused; others' applications and after submission refused; students and anonymous cannot download |
| `31-public-pages.test.ts` | Contact form: needs token, stores, attaches user, honeypot, limit; blog drafts 404; search finds mentors; sitemap lists published content |
| `32-staff-console.test.ts` | Screen access by role; navigation; queue lists submitted only; no password hashes; search treats `%` and `_` literally; filters; paging without loss or repeats; enquiries inbox and handled once; audit viewer and filter probing; members screen; overview counts per role |
| `33-event-notifications.test.ts` | One notice and one e-mail with absolute link and IST time; no repeat on double registration; shown on dashboard; nothing on cancel or refusal |
| `36-journey-student.test.ts`, `37-journey-staff.test.ts` | End-to-end student and staff journeys including start, answer, verify gate, submit, track, event register, review to acceptance, notifications, audit |
| `40-analytics.test.ts` | Forged events refused; malformed and oversized refused; props narrowed; flood limited |
| `41-storage-reconcile.test.ts` | Dry run removes nothing; apply removes old orphan only |
| `43-cms-audit.test.ts` | create, publish, unpublish, delete audited with the staff actor |
| `70-core-journey.test.ts` | Return path survives sign-up and onboarding; hostile path ignored; failed finish stays put; stale answer rejected at submit; ten simultaneous submits give one |

## 3. Gaps

Not exercised by any test found in the files read:

- `submitApplication` for a draft whose status is forced to `submitted` by staff (D-2); the status route with `status: 'submitted'`.
- Applicant `getOwnedApplicationDetail` snapshot substitution (reviewer side is covered at `26-concurrency.test.ts:258`).
- The `onboarding/step` route's unknown or inherited step names; the step handlers' validation errors.
- `MAX_REMOVALS`, the pre-delete row re-check and the worker schedule.
- `getActivatedBuildersCount` and `getTableTruth` values (only that the page renders and agrees with the database).
- Search escaping of `%` and `_` in the public search.
- `unregisterFromEvent`.
- Truncation of long snapshot values in the audit viewer beyond `summariseSnapshot` unit tests.

## 4. Running them

Commands are in `package.json` scripts and the handover runbook; this volume did not execute them. Integration tests require the environment described in `tests/support/` and do not run against a bare checkout.
