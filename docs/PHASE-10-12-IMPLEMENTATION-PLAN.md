# Phase 10-12 Implementation Plan — Search, Analytics, Security, Performance, Polish

> Written after `PHASE-7-9-RETROSPECTIVE.md`, which this plan carries forward
> directly — §1 below is that retrospective's priority list turned into a build
> gate, the same way `PHASE-7-9-IMPLEMENTATION-PLAN.md §1` turned Phase 5-6's
> retrospective into a gate before any new UI. Two consecutive retrospectives have
> now named the same three application-engine bugs as top priority without a
> commit against them; this plan schedules them explicitly rather than trusting
> them to get picked up opportunistically a third time.

---

## 0. The standard this phase is held to

- **Nothing here is decoration.** Search, analytics, rate limiting and the N+1
  fixes all exist because a real gap was found and verified — not because a
  phase named "polish" implies busywork. If a line item here turns out not to
  matter, it's cut, not padded to look complete (§45).
- **Analytics never fabricates.** `analyticsEvents` starts empty and stays
  honest — a funnel with zero rows renders zero, the same discipline
  `docs/db/seed.ts` already holds for startups, mentors and metrics (§46).
- **Search is real.** Postgres queries against the actual `cms` tables through
  Payload's own `where` operators, not a client-side filter over an
  already-fetched list.
- **The gate in §1 happens first.** Building `/search` before extracting the
  filter-bar duplication (§1.2) would make it a sixth hand-copy of a pattern
  already flagged twice; building analytics event calls into routes that are
  about to be rewritten for transactions (§1.1) would mean writing them twice.

---

## 1. Gate — the carried-forward fixes (do these first)

Direct response to `PHASE-7-9-RETROSPECTIVE.md §1, §2, §3`. Small, well-scoped,
and each one blocks something later in this plan.

### 1.1 The three application-engine bugs + transactions

All four live in `src/server/applications/{actions,review}.ts`, none touched
since Phase 5-6:

- **`changeApplicationStatus` uses the wrong guard.** Change
  `requireAdminArea('applications')` to take an already-authorized staff user
  as a parameter, resolved by the caller: the two page components
  (`src/app/(staff)/admin/applications/{page,[id]/page}.tsx`) call
  `requireAdminArea` themselves and pass the result in; the route handler
  (`src/app/api/admin/applications/[id]/status/route.ts`) calls
  `requireStaffOrThrow` and passes that instead. `changeApplicationStatus`
  itself no longer calls a guard — it trusts its caller, the same shape
  `markNotificationRead` and `registerForEvent` already use correctly.
- **`startApplication`'s idempotency becomes atomic**: replace the
  check-then-insert with `.insert(applications).values(...).onConflictDoNothing().returning()`,
  re-querying for the existing row only if the insert returns nothing —
  the exact fix `registerForEvent` already demonstrates working correctly in
  this codebase.
- **`submitApplication` checks `program.applicationStatus === 'open'`**, not
  only the deadline — matching the check `startApplication` already has, so
  the two entry points to the same state machine agree again.
- **Both `submitApplication` and `changeApplicationStatus` wrap their
  multi-step mutation in `db.transaction()`** — status update, audit-log
  insert (where applicable), and `notify()`'s own insert all commit together
  or not at all. `notify()`'s email send stays outside the transaction (it
  already has its own `.catch()` and must never roll back a committed status
  change just because SES is down).

**Acceptance criteria.** A script (new: `scripts/verify-application-flow.sh`,
modeled on `verify-auth-flows.sh`) exercises: two concurrent `startApplication`
calls for the same user+program both return the same `applicationId`, neither
500s; a program manager closing a program's `applicationStatus` mid-cohort
blocks a pending draft from submitting; a `curl` from a route handler context
against the status-change endpoint with a non-staff cookie returns JSON `403`,
not an empty `404` body.

### 1.2 Extract the filter-bar and result-summary duplication

Direct response to retrospective §2 — `programs/filters.tsx`,
`events/filters.tsx`, and `startups/filters.tsx` hand-copy the same
`setFilter`/`hasFilters`/"Clear all" logic; `resultSummary()` is hand-copied
five times.

- **`src/lib/use-url-filters.ts`** (new): a small hook —
  `useUrlFilters(basePath: string)` returning `{ get(key), set(key, value),
  clear(), hasAny(keys) }` over `useSearchParams`/`useRouter`. Replaces the
  body of all three existing `filters.tsx` files; each keeps its own JSX (the
  option lists and labels genuinely differ) but stops re-deriving the
  URL-mutation logic.
- **`src/lib/result-summary.ts`** (new): one `resultSummary(count, hasFilters,
  { noun, emptyNoFilters, emptyWithFilters })` function replacing the five
  hand-written copies in `programs/page.tsx`, `events/page.tsx`,
  `resources/page.tsx`, `startups/page.tsx`, and `mentors/page.tsx`.

This is the direct prerequisite for §2 (`/search`) — search needs the same
shape (a query, a result count, an empty state) a sixth time, and should be
the first page built *against* the shared helpers rather than the reason they
finally get extracted.

**Acceptance criteria.** All five existing filtered list pages behave
identically before and after (same URL params, same "Clear all" behavior,
same announced summary text) — this is a refactor, not a UX change, verified
by re-running the existing live-curl checks each of 7-9.3 through 7-9.6 used.

### 1.3 The journey-selector `aria-live` gap

`src/app/(public)/journey-selector.tsx`'s response panel gets a
`<LiveRegion message={option.response} />` wrapping the reveal, matching the
pattern already used in `NotificationsList` and every filtered list page.
One-line fix, verified with a screen-reader-equivalent check (confirm the
live region's text content changes on selection, same assertion style
`verify-auth-flows.sh` already uses for other DOM state).

### 1.4 Centralize empty-state copy

`src/lib/empty-state-copy.ts` (new): exports the `CONTENT_SPEC.md §8` table as
named constants (`STARTUPS_EMPTY`, `MENTORS_EMPTY`, `EVENTS_EMPTY`,
`PROGRAMS_EMPTY`, `RESOURCES_EMPTY`, `SEARCH_EMPTY`). Every `EmptyState`
call site that currently hand-types this copy (`startups/page.tsx`,
`invest/page.tsx`, `built-with-knest.tsx`, `resources/page.tsx`,
`student-view.tsx`, `founder-view.tsx`, `mentors/page.tsx`) imports from here
instead. A future copy edit touches one file.

---

## 2. Search

**User problem.** `PRODUCT_ARCHITECTURE.md §3` already lists `/search` as a
public route; it has never been built. A visitor who knows roughly what
they're looking for ("mentors who know fundraising," "the design sprint
program") has no way to find it except guessing which of six top-level nav
items to click.

**User journey.** Any page → search (header input, §5.1) → `/search?q=...` →
results grouped by type (Programs, Startups, Events, Resources — Mentors and
Partners excluded, see below) → click through to the real page. Empty or
no-match: `CONTENT_SPEC.md §8`'s exact copy, `NOTHING MATCHED "[QUERY]"` with
the query interpolated, via the new `SEARCH_EMPTY` — the one entry in that
table that isn't a static string, so it stays a small function rather than a
constant.

**Data model.** No new schema. `src/server/content/search.ts` (new) runs one
`payload.find` per searchable collection with `overrideAccess: false` (same
discipline as every other content-layer read — a draft program is exactly as
invisible to search as it is to `/programs`), using Payload's `like` operator
(Postgres `ILIKE` under the hood, confirmed supported —
`node_modules/payload/dist/types/constants.ts`'s `validOperators`) against
each collection's title/tagline-or-summary field:

```ts
type SearchResult = { type: 'program' | 'startup' | 'event' | 'resource'; id: number; title: string; summary: string; href: string }

export async function search(query: string): Promise<SearchResult[]>
```

Four parallel queries (`Promise.all`), not sequential — the same pattern
`TheJourney` should have used (§1 doesn't touch `the-journey.tsx` directly,
but this is the correct shape to model it after once that fix lands in §4).
Results merge and rank by a simple rule: exact-title match first, then
collection order (programs, startups, events, resources — reflecting the
funnel's own priority), then recency within each collection. No relevance
scoring library — a `like` match against four small collections doesn't
justify one, and a bad ranking here is a UX nit, not a correctness bug worth
adding a dependency for.

**Mentors and Partners are deliberately excluded from full-text search.**
Both are already need-first/browse-first surfaces by design (§4.5/§4.6 of the
Phase 7-9 plan) — a name-substring search over a small, staff-curated
directory adds a second, worse way to find the same thing the expertise
filter already does well. If mentor search is genuinely requested later, it's
a small addition to `search()`; not building it now isn't a limitation, it's
consistent with the existing "not a marketplace" decision.

**Route structure.** `/search` only, `?q=` as the URL param (shareable,
consistent with every other filtered list page's URL-as-state convention).

**Permissions.** Public read only — same `overrideAccess: false` guarantee as
every other public content read.

**Components.** Reuses `LinkCard`, `Tag` (as a type badge — "Program",
"Startup", "Event", "Resource"), `EmptyState`, `LiveRegion`, and the new
`resultSummary()` from §1.2. No new primitive needed.

**Analytics events.** `search_query` (with the query string and result
count), `search_result_click` (with type and target id) — see §3; this is the
first feature built with its analytics calls written alongside the feature
rather than retrofitted, per the retrospective §11 process recommendation.

**Empty states.** Two distinct ones: no query yet (a plain prompt, not
`EmptyState` — there's nothing wrong to explain), and a query with zero
matches (`SEARCH_EMPTY`, §1.4).

**Acceptance criteria.** A search for a program's exact title returns it
first; a search matching both a program and an event returns both, grouped
correctly; a draft program never appears regardless of title match (verified
live, same method as every prior content-layer read); an empty query renders
the prompt state, not the no-results state.

**E2E tests.** Seed a program and a resource with a shared distinctive word in
their titles via the CMS API, assert `/search?q=<word>` returns both grouped
under the right type headings; assert a nonsense query renders `SEARCH_EMPTY`
with the query correctly interpolated; delete the fixtures, confirm empty.

---

## 3. Analytics

**User problem.** Every page in this product has been built and verified by
hand, one curl session at a time, across ten sub-phases — there is currently
no way to answer "does anyone actually use the journey selector," "where do
signups drop off," or "which programs get application-started but not
finished" without reading raw Postgres rows. The original core-loop plan
named this explicitly: funnel-staged events, a North Star metric, real rows
only.

**Data model.**

```ts
// src/db/schema/analytics.ts (new)
export const analyticsEvents = appSchema.table('analytics_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), // null = anonymous
  sessionId: text('session_id').notNull(), // a short-lived cookie, not tied to auth
  event: text('event').notNull(),
  props: jsonb('props'), // small, event-specific — never PII beyond what's already in `users`
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('analytics_events_event_idx').on(table.event),
  index('analytics_events_user_idx').on(table.userId),
])
```

`userId` nullable and `onDelete: 'set null'` (not `cascade`) deliberately —
funnel counts should survive a user deleting their account; only their
identity is severed, matching how the rest of the schema treats deletion as
rare and handled explicitly rather than assumed away (retrospective's
still-open "no archival convention" note, §5 there — this table is the one
place in the schema where "keep the row, drop the identity" is the correct
default, worth using as the model for that broader convention later).

**`src/server/analytics/track.ts`** (new): `track(event, props?, sessionId?)` —
server-side only, called from server actions and route handlers, never a
client-side SDK (no PostHog/Segment/etc — the whole point is real, owned
rows, not a third-party dependency for a five-table funnel). A thin
`getOrSetSessionId()` helper reads/writes a non-HttpOnly, non-auth cookie
(`knest_sid`) so anonymous funnel stages (landing, journey selector) are
attributable to one visit without requiring a login.

**Funnel stages and events** (from the original core-loop plan, wired to
real call sites verified to exist):

| Stage | Event | Call site |
|---|---|---|
| Acquisition | `landing_view` | `(public)/page.tsx` |
| Activation | `journey_selector_choice` (with path), `signup`, `onboarding_completed` | `journey-selector.tsx`, `signup-form.tsx`, `completeOnboarding` |
| Intent | `program_view`, `application_start`, `application_submit` | `programs/[slug]/page.tsx`, `startApplication`, `submitApplication` |
| Engagement | `event_register`, `resource_view`, `startup_view`, `search_query` | `registerForEvent`, `resources/[slug]/page.tsx`, `startups/[slug]/page.tsx`, `search()` |
| Outcomes | `application_accepted` | `changeApplicationStatus` (on transition to `accepted`) |

**North Star: Activated Builders** — a user who (1) completed onboarding, (2)
has a `journeyStage`, and (3) has at least one `application_start`,
`event_register`, or `startup_view`-driving action recorded. Computed as a
query over real `users` + `analyticsEvents` rows, not a stored counter — it's
cheap enough at this scale and a stored counter would be one more thing that
can drift from the truth.

**Route structure.** `/admin/analytics` (new, staff-only) — a single funnel
report page: raw counts per stage, the Activated Builders number, all
computed live. **Zero rows renders zero** (§46) — the page's own empty state
when nothing has been tracked yet says so plainly, the same discipline every
public empty state already holds.

**Permissions.** `requireAdminArea('analytics')` — a new `AdminArea` value
alongside the existing `applications`/`content`/etc (`src/server/auth/roles.ts`).

**CMS requirements.** None — this is entirely `app`-schema.

**Empty states.** The funnel report before any events exist: "No activity
tracked yet." — not a chart with all-zero bars pretending to be data, an
honest sentence.

**Acceptance criteria.** Loading the homepage produces a `landing_view` row
with the anonymous session cookie set; completing signup produces a `signup`
row linked to the new `userId`; the admin funnel page's counts match a direct
`SELECT count(*) FROM app.analytics_events GROUP BY event` for the same
window.

**E2E tests.** Walk the core loop once (land → journey selector → signup →
onboarding → apply → submit) against a clean events table, assert each
expected event row exists with the right `userId`/`sessionId` linkage; assert
the funnel report's numbers match.

---

## 4. Security hardening

Three items, each already named as a deliberate, documented gap in
`PHASE-5-6-RETROSPECTIVE.md §5` or the original core-loop plan's security
section — closing them now rather than leaving them "deferred" indefinitely.

**4.1 Rate limiting.** A Postgres-backed token bucket
(`src/server/security/rate-limit.ts`, new; `app.rate_limits` table: key,
`tokens`, `updatedAt`) applied to auth routes (`login`, `signup`,
`reset/request`), the application file-upload route, and `startApplication`.
Keyed by `IP + route` for anonymous routes, `userId + route` for
authenticated ones. Deliberately simple (no Redis/ElastiCache — the original
plan named that as a later upgrade, not a Phase 10-12 requirement) — a
single `UPDATE ... RETURNING` per check, cheap at this scale.

**4.2 File content verification.** The upload route currently trusts the
client-supplied `Content-Type` (retrospective §5, unchanged since Phase 5-6).
Add magic-number sniffing (`file-type` package, already MIT/small — checked
against the declared extension allowlist already enforced) before the buffer
reaches `putFile`. A mismatch is rejected with the same user-facing error as
an oversized file, not a new error class the UI doesn't handle yet.

**4.3 Security headers + CSP.** `next.config.ts` gains a `headers()` export:
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, and a CSP scoped to what
the app actually loads (self + the Payload admin's own inline-script needs,
verified against a real `/admin` page load rather than copied from a
template — Payload's admin UI needs `unsafe-inline` for its own bundled
styles as of this version, confirmed by checking a real response with CSP
report-only mode first before enforcing).

**Acceptance criteria.** Six rapid login attempts from one IP get a 429 on
the sixth (not the fifth or seventh — the exact bucket size is a documented
constant, not a magic number); a `.pdf` renamed to `.jpg` and uploaded to the
application file field is rejected; `/admin` still renders and functions
with CSP enforced, verified by loading it in a real browser (Playwright, per
this project's established verification method), not just checking the
response headers.

---

## 5. Performance

All four items are named, verified-still-present findings from
`PHASE-7-9-RETROSPECTIVE.md §8` and `PHASE-5-6-RETROSPECTIVE.md §8` — no new
investigation needed, just the fixes:

1. **`TheJourney`'s seven parallel queries become one.** `listPrograms({})`
   once, grouped by `stage` in memory. Same visible output, one round trip
   instead of seven.
2. **Batch the three named N+1 patterns** (`listApplicationsForUser`,
   `listApplicationsForReview`, `listProgramCohortsWithStartups`) — replace
   each `Promise.all(rows.map(fetchOne))` with one `where: { id: { in:
   [...] } }` fetch, keyed by id in memory afterward.
3. **`getApplicationProgramBySlug` stops double-fetching** — map the
   already-fetched-by-slug document directly instead of discarding it and
   calling `getApplicationProgram(id)` again.
4. **Right-size `getProgramBySlug`'s `depth: 2`** to what the page actually
   renders (verified by reading `programs/[slug]/page.tsx`'s actual field
   usage, not assumed) — likely `depth: 1` is sufficient once checked.

**Acceptance criteria.** Each fix is verified by counting actual Payload/DB
calls per page load (a temporary log-and-count, removed after verification —
not a permanent instrumentation layer, that's §3's job) before and after,
confirming the round-trip count actually dropped and the rendered output is
byte-identical.

---

## 6. Polish & quality gates

**6.1 Header notification indicator.** Retrospective §7's open question,
resolved here: a small unread-count badge on `SiteHeader`'s account menu when
signed in, reading the same `countUnread()` §7-9.9 already built. Not a full
dropdown — clicking it goes to `/dashboard`, where the existing
`NotificationsList` lives. Small, and closes the "only discoverable by
visiting the dashboard" gap without building a second notifications UI.

**6.2 CMS question stable `value`.** `PHASE-5-6-RETROSPECTIVE.md §13`'s naming
inconsistency: `Programs.applicationQuestions.options` gets a `value` field
alongside `label`, matching the `{label, value}` pattern already used
everywhere else in the CMS (`src/payload/fields/taxonomy.ts`).
`schemaForQuestion`'s select/multiselect validation switches from checking
against labels to checking against values. A **data migration note, not a
data migration**: zero applications have been submitted against any program
in this dev environment (verified — `app.applications` is empty at every
phase boundary this session ended on), so there's no existing answer data to
reconcile.

**6.3 Quality gate pass.** Lighthouse (Performance/Accessibility/SEO ≥ 90) on
`/`, `/programs`, `/programs/[slug]`, `/apply/[program]`, `/search` — the
original core-loop plan's own bar, never actually run against real pages
until now since they didn't exist yet. `axe` clean on every public route.
Full keyboard traversal of the homepage's five signature experiences
(hero has no interactive element to reach; journey selector's radio group;
the journey rail's links; ecosystem's links; built-with-knest's cards) —
verified by tabbing through in a real browser, not asserted from the ARIA
roles alone. `prefers-reduced-motion` confirmed to neutralize
`.animate-rise-fade` (the one animation Phase 7-9 added) via a real browser
with the media feature forced, not just trusted from the global CSS override
existing.

**Acceptance criteria.** Each Lighthouse/axe run's actual output is captured
(not just "passed") — a score of 89 on one metric with a documented reason
(e.g., a large hero image once real media exists) is an honest outcome; a
silently-lowered bar isn't.

---

## 7. Build order

```
1  Gate: the three application-engine bugs + transactions      (§1.1)
2  Gate: filter-bar/result-summary extraction                  (§1.2)
3  Gate: journey-selector aria-live + empty-state copy          (§1.3, §1.4)
4  Search                                                       (§2)
5  Analytics schema + track() + funnel wiring                   (§3)
6  Security: rate limiting, file verification, headers/CSP      (§4)
7  Performance: the four named fixes                            (§5)
8  Polish: header notification indicator, CMS value field        (§6.1, §6.2)
9  Quality gate pass: Lighthouse, axe, keyboard, reduced-motion  (§6.3)
```

Committed in reviewable increments on `claude/knest-ecosystem-platform-g9erjs`,
each verified live against a running server with real fixtures created and
deleted through the CMS/DB — the same discipline every Phase 7-9 sub-phase
held, not relaxed for being the last phase in this slice.

---

## 8. Explicitly deferred

Redis/ElastiCache-backed rate limiting (Postgres token bucket is the stated
interim, §4.1), a client-side analytics SDK (server-side `track()` is
sufficient at this scale and keeps the data owned, §3), mentor/partner search
(§2's own reasoning), a full notifications dropdown UI (§6.1's badge is
enough for now), and any UI for the `analyticsEvents` table beyond the single
funnel report (a per-user activity timeline, cohort comparison charts) — none
of these are needed to close the gaps this plan was written to close, and
building them now would be the "stubbed to look big" failure mode this
project has avoided since Phase 0.
