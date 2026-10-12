# Volume E2: Applications engine and operations

Engineering reference for the operational half of the KNEST application: the applications engine, the staff review console, documents and storage, onboarding and recommendation, events, enquiries, members and staff administration, the audit trail, analytics, and the content delivery layer.

Basis: branch `codex/production-v1` at commit `383abf9`. Every statement is taken from reading the source and tests named in the text; nothing here was executed, and nothing claims verification in a deployed environment. Where the code does not settle a question the text says "not determined from the code".

## Files

| # | File | Covers |
|---|---|---|
| 01 | [applications-data-model-and-lifecycle](01-applications-data-model-and-lifecycle.md) | Tables, where questions come from, `closedReason`, the status state machine |
| 02 | [applicant-flow](02-applicant-flow.md) | Start, save, upload, submit; row-lock concurrency model; routes |
| 03 | [review-console](03-review-console.md) | Queue, detail, status change, document download, who may do what |
| 04 | [documents-and-storage](04-documents-and-storage.md) | Storage abstraction, key generation, content verification, orphan reconciliation |
| 05 | [onboarding-and-recommendation](05-onboarding-and-recommendation.md) | Step handlers, rule-based recommendation, return paths |
| 06 | [events-registration](06-events-registration.md) | Capacity locking, idempotency, notifications, calendar file |
| 07 | [enquiries](07-enquiries.md) | Contact form defences, staff inbox |
| 08 | [members-and-staff-administration](08-members-and-staff-administration.md) | Roles, deactivation, last-admin guard, overview, shell |
| 09 | [audit-trail](09-audit-trail.md) | Table, action catalogue, CMS hooks, viewer |
| 10 | [analytics](10-analytics.md) | Event capture, client allow-list, funnel, reconciliation |
| 11 | [content-delivery-layer](11-content-delivery-layer.md) | Payload readers, access rules, search, homepage, counters |
| 12 | [routes-guards-and-rate-limits](12-routes-guards-and-rate-limits.md) | Per-route matrix of guards, limits, audit, failures |
| 13 | [configuration-reference](13-configuration-reference.md) | Environment variables, constants, CMS-driven behaviour |
| 14 | [tests-and-coverage](14-tests-and-coverage.md) | What each test asserts, and gaps |
| 15 | [known-limitations-and-defects](15-known-limitations-and-defects.md) | Numbered defects with file and line, design limits, open questions |

## Module map

| Source directory | Described in |
|---|---|
| `src/server/applications/` | 01, 02, 03 |
| `src/server/storage/`, `src/server/security/file-verify.ts` | 04 |
| `src/server/onboarding/` | 05 |
| `src/server/events/` | 06 |
| `src/server/enquiries/` | 07 |
| `src/server/members/`, `src/server/admin/` | 08 |
| `src/server/audit/`, `src/payload/audit-hooks.ts` | 09 |
| `src/server/analytics/` | 10 |
| `src/server/content/` | 11 |
| `src/app/api/{applications,admin,enquiries,events,onboarding,analytics}` | 02, 03, 05 to 08, 10, 12 |
| `src/app/(member)`, `src/app/(staff)`, `src/app/(public)` pages | the file of the module each page uses |

## Cross-cutting facts

1. **No Server Actions.** These modules are plain server functions called only from route handlers and server components. The compiled manifest is tested to contain none of them (`tests/integration/01-server-action-boundary.test.ts`).
2. **Authority comes from the session, read from the database on each request.** Roles are not cached in a token; role changes also delete sessions (file 08).
3. **Concurrency is handled by the database**, not by application memory: a row lock for draft writers, a compare-and-set for review decisions, a transaction-scoped advisory lock for event capacity and for staff membership, and unique indexes for idempotency.
4. **Cross-schema references have no foreign keys.** `program_id` and `event_id` hold Payload ids; integrity is enforced in code and by a `beforeDelete` hook (file 01).
5. **Side effects follow the commit.** E-mail and analytics are sent after the transaction that changed the data, and failures of either are logged, not propagated.
6. **The public site never shows drafts through the content layer** because every read is anonymous-scoped (file 11).
7. **Honest empties.** Lists return nothing rather than invented records; counters hide zero values.

## Reading order for a new engineer

Start with 01 and 02 (the core invariants), then 03, then 12 for the guard vocabulary. Read 15 before changing anything: three items (D-1, D-2, D-4) are live defects in the main applicant and reviewer paths.

## Related documents outside this volume

`docs/handover/ARCHITECTURE.md`, `docs/handover/REFERENCE-ROUTES.md`, `docs/handover/REFERENCE-ENVIRONMENT.md`, `docs/handover/RUNBOOK.md`, `docs/delivery/HD-06-PRIVACY-INPUTS.md`.
