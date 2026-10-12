# 10. Analytics: event capture, funnel and reconciliation

Module: `src/server/analytics/` (`track.ts`, `client-events.ts`, `funnel.ts`, `reconcile.ts`), route `src/app/api/analytics/track/route.ts`, query-text policy `src/lib/search-query-log.ts`, viewer `src/app/(staff)/admin/analytics/`, table `app.analytics_events`.

## 1. Principles

- **First-party, server-side only.** No third-party analytics SDK; rows are written straight to Postgres so the data is owned and not sent elsewhere (`track.ts:40-46`).
- **Events are best-effort; tables are the truth.** An event write failure must never break the request that triggered it. The dashboard therefore shows event counts next to counts taken from the tables that own the same outcome and states any gap in words (`funnel.ts:174-178`, `reconcile.ts:1-9`).
- **Browsers may only write one allow-listed event.** All business-outcome events are emitted from server code.

## 2. Table

`src/db/schema/analytics.ts:16-31` (counted from that file's start): `id`, `user_id` (nullable FK, `ON DELETE SET NULL`), `session_id` NOT NULL, `event` text, `props` jsonb, `created_at`. Indexes on `event` and `user_id`. `SET NULL` rather than cascade is deliberate: the fact that a stage was reached outlives the account; only identity is severed.

No index on `created_at`, and no retention job in code; the proposed retention (12 months) is in the privacy inputs, not implemented.

## 3. `track(event, props?, options?)`

`track.ts:52-69`.

```
track(event: string, props?: Record<string, unknown>, options?: { userId?: string }): Promise<void>
```

- Resolves the current session user (`getSessionUser`) and a visit id in parallel, inserts one row, and **catches and logs every error** (`:66-68`). It never throws.
- `userId` defaults to the session user; the override exists for `application_accepted`, where the acting session is staff and the event is about the applicant (`:47-50`, `review.ts:187`), and for `signup`, where the new user has no session yet (`auth/actions.ts:86`).
- Visit id: cookie `knest_sid`, `httpOnly`, `sameSite=lax`, 180 days, path `/` (`:6,25-32`). Cookies can be set only from a route handler or action, not during Server Component rendering, so a purely page-view-driven visit gets a **new id on every render** until some action sets the cookie (`:9-19,33-36`). Consequence: `session_id` cannot be used to count visitors or to join page views; it is reliable only across events that fire from handlers.
- It issues two awaits on the critical path of the page that calls it (session lookup plus insert), and pages call it before rendering (e.g. `programs/[slug]/page.tsx:30`), so a slow database slows those pages by one round trip.
- `track.ts` has no `server-only` import and no props size limit; callers pass small literals.

## 4. Event catalogue

Funnel stages (`funnel.ts:8-14`) and where each event is emitted:

| Stage | Event | Emitted from |
|---|---|---|
| acquisition | `landing_view` | `src/app/(public)/page.tsx:44`, every home page render |
| activation | `journey_selector_choice` | the browser, via `/api/analytics/track` (only allow-listed client event) |
| activation | `signup` | `src/server/auth/actions.ts:86` (password signup; no emitter was found for Google sign-in) |
| activation | `onboarding_completed` | `onboarding/actions.ts:133`, every call (not de-duplicated) |
| intent | `program_view` | `programs/[slug]/page.tsx:30` |
| intent | `application_start` | `actions.ts:77`, only when a row was created |
| intent | `application_submit` | `actions.ts:318`, after commit |
| engagement | `event_register` | `events/actions.ts:72`, only for a new registration |
| engagement | `resource_view`, `startup_view` | `resources/[slug]/page.tsx:32`, `startups/[slug]/page.tsx:29` |
| engagement | `search_query` | `search/page.tsx:24`, each non-empty search |
| outcomes | `application_accepted` | `review.ts:187`, on acceptance, attributed to the applicant |

Page-render events fire for every request including crawlers and prefetches; there is no bot filter. The proxy marks pages `noindex` while indexing is off (`proxy.ts:15`), which reduces but does not remove crawler hits.

## 5. Client ingestion: `POST /api/analytics/track`

`route.ts:22-50`. Open to signed-out visitors, because the choice made before signup is the most useful data point. Defences, in order:

1. `Content-Length` over 2048 bytes: 413.
2. Per-IP rate limit `analytics:<ip>`: 60 per 10 minutes (`rate-limit.ts:23`). Over the limit it answers **204**, not 429: the client is fire-and-forget and dropping the write is the honest outcome. If the limiter's own database call fails, it also drops with 204 (`:29-34`): an unlimited write path must not open, and analytics must not break pages.
3. Body read as text and length-checked again (413). This uses `text.length` (UTF-16 code units), not bytes, so multi-byte content can be up to roughly 2x the byte limit; the earlier header check covers honest clients only.
4. JSON parse; `parseClientEvent` (`client-events.ts:39-44`) requires `event` to be in `CLIENT_EVENTS`, which currently holds exactly `journey_selector_choice` (`:10`). Anything else: 400 "Unknown event.".
5. `sanitiseProps` (`:25-36`): a flat object only; at most 5 keys; keys 1..32 chars; string values cut to 64 chars; numbers must be finite; booleans pass; everything else (objects, arrays, null) is dropped.
6. `track(event, props)`.

Why an allow-list and not a filter: the staff analytics page cannot tell a forged row from a real one, so the door must list what may enter (`client-events.ts:1-8`). Test `src/app/api/analytics/track/route.test.ts` (mocks) and `tests/integration/40-analytics.test.ts` (forged outcome events rejected and nothing written; malformed and oversized refused; props narrowed; at most 60 stored from one address, the rest 204).

Residual: the 60-event limit is per IP; the stored `userId` is whatever session accompanies the request, so a signed-in user can write up to 60 `journey_selector_choice` rows per 10 minutes under their id. Those events are only shown as counts.

## 6. Search query logging policy

`toLoggedSearch(raw, resultCount)` (`src/lib/search-query-log.ts:28-42`): collapse whitespace and trim; always record `queryLength` and `resultCount`; store the text lower-cased only if non-empty, at most 64 characters, and containing no e-mail-like token, no URL, and no run of six or more digits (allowing separators). Otherwise `query` is `null`. Reason: people paste their own personal data into search boxes. Heuristic, not a guarantee: names and free text are stored. Rows are meant to be aged out with the event log (the referenced `docs/delivery/SEARCH-RETENTION.md` was not checked here).

## 7. Reading: `funnel.ts`

| Function | Lines | Method |
|---|---|---|
| `getEventCounts()` | `:19-26` | `SELECT event, count(*) GROUP BY event`; events with zero rows are simply absent |
| `getActivatedBuildersCount()` | `:35-59` | North Star: distinct `user_id` having at least one of `application_start`, `event_register`, `startup_view`, intersected with users who have `onboarding_completed_at` and a `journey_stage` |
| `getTableTruth()` | `:66-83` | six counts from owning tables (below) |

`getActivatedBuildersCount` fetches every distinct matching `user_id` into application memory and then sends them back as an `IN (...)` list. It is correct but scales linearly in users and parameters; it will need rewriting as a join or `EXISTS` once users number in the tens of thousands. Computed live; no stored counter, so it cannot drift (`:41-47`).

### Truth mapping and what a gap means

| Event key | Table count | Typical reasons for a difference |
|---|---|---|
| `signup` | all rows in `users` | seeded and staff accounts, Google sign-ups (no event found); events cannot exceed records except via removed accounts (`SET NULL` keeps events) |
| `onboarding_completed` | users with `onboarding_completed_at` | events can **exceed** records: the event fires on every `complete` call (file 05) |
| `application_start` | all `applications` rows | none expected beyond pre-tracking data |
| `application_submit` | applications with status not `draft` | a staff-forced submit (D-2) creates a record with no event |
| `application_accepted` | applications with status `accepted` | none expected |
| `event_register` | all `event_registrations` | events exceed records after cancellations, because unregister deletes the row but not the event |

## 8. Reconciliation

`reconcileFunnel(recorded, records)` (`reconcile.ts:22-54`): for each key in `records` (sorted), `difference = recorded - records`; state `match`, `events-missing` (negative: "trust the records") or `records-removed` (positive: "something was removed after it was counted, such as a cancelled registration"). Only keys present in the truth map are reconciled. The fixed note text for the positive case is wrong for `onboarding_completed`, where the cause is repeat completion, not removal.

The page (`analytics/page.tsx`, from its first line) shows: Activated Builders; each stage's event counts with "Records in the database: N" where a truth key exists, else "Events only"; and a list of non-matching reconciliation rows. With no events and no records it says "No activity tracked yet." Access: super admin only (`roles.ts:28`, `analytics/layout.tsx`). There is no date range, cohort or export.

## 9. Configuration and failure modes

No environment variables. If the database is unavailable `track` logs and returns; the client route answers 204 for limiter failure but 200 `{ok:true}` even when `track` swallowed an insert failure (`route.ts:48-49`). Rate limiting and tracking share the same database as the rest of the app.

## 10. Tests

`client-events.test.ts` (allow-list, malformed bodies, prop sanitising), `reconcile.test.ts` (match, missing, removed, ordering), `route.test.ts`, `search-query-log.test.ts`, integration `40-analytics.test.ts`. No test covers `getActivatedBuildersCount` or `getTableTruth` directly beyond the integration page checks, and none covers `track`'s cookie behaviour.
