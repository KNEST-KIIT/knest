# Phase 7-9 Retrospective — Dashboard, Homepage Narrative, Ecosystem Surfaces

> Same discipline as `PHASE-5-6-RETROSPECTIVE.md`: every finding below was verified
> by re-reading the actual files or testing live against a running server, not
> inferred from commit messages. Scoped to what materially affects correctness,
> security, maintainability, UX, or Phase 10-12 — not style preferences.
>
> Severity: 🔴 fix before or during Phase 10-12 · 🟡 real but can wait · ⚪ noted, no action needed yet

---

## 1. The Phase 5-6 priority list, re-audited

Six items were carried into this phase with explicit priority. Re-reading the
actual code rather than trusting the earlier commit messages:

| # | Item | Status |
|---|---|---|
| 1 | Design system consolidation (`Table`, `Avatar`, `SectionHeading` adoption) | ✅ Done — 7-9.1 |
| 2 | Surface notifications in the dashboard | ✅ Done — 7-9.9 |
| 3 | Fix the `review.ts` guard-pattern bug | 🔴 **Still broken** |
| 4 | Wrap multi-step mutations in transactions | 🔴 **Still unaddressed** |
| 5 | Close the `applicationStatus` gap on submit; atomic `startApplication` | 🔴 **Still unaddressed** |
| 6 | `aria-live` regions for filter counts, save indicator, submit outcome | ✅ Done — 7-9.1 |

Items 3-5 were named explicitly, in order, as what to fix — and none of the three
touch any file this phase actually modified. `src/server/applications/review.ts`
and `src/server/applications/actions.ts` have zero commits against them across all
of 7-9.1 through 7-9.10. This isn't a partial fix that missed an edge case; the
work was never started.

🔴 **`changeApplicationStatus` still calls `requireAdminArea`, not
`requireStaffOrThrow`.** Re-verified live:

```
$ curl -s -o /dev/null -w '%{http_code}' -b student.jar -X POST \
    .../api/admin/applications/<id>/status -d '{"status":"under_review"}'
404
```

Same empty-body 404 the 5-6 retrospective documented. Nothing new broke; nothing
was fixed either.

🔴 **`startApplication`'s idempotency is still check-then-insert**
(`src/server/applications/actions.ts:43-51`) — the exact race described in
PHASE-5-6-RETROSPECTIVE.md §4, unchanged. Notably, 7-9.3's `registerForEvent` was
written with `.onConflictDoNothing()` specifically *because* this was a known,
named bug — the fix pattern was applied to new code but never back-ported to the
original.

🔴 **`submitApplication` still doesn't check `program.applicationStatus`**, only
`applicationDeadline` (`src/server/applications/actions.ts:154`). `startApplication`
*was* extended at some point to check `applicationStatus !== 'open'` before this
phase — so the two entry points to the same state machine now disagree on which
signal gates them, which is arguably worse than before: a program manager who
closes applications mid-cohort blocks new applicants from starting but not
existing drafts from submitting.

🔴 **No transactions.** `submitApplication` (status update → `notify()`, itself an
insert + email) and `changeApplicationStatus` (status update → audit log insert →
`notify()`) remain sequential, unwrapped statements. Same two failure modes as
before: a crash between the status update and the audit-log insert leaves a
status change with no audit trail; a crash in `notify()`'s insert reports failure
to a client whose mutation already committed.

**These three are the single most important carry-forward for Phase 10-12** — not
because they're new, but because two full phases have now named them as the top
priority without touching them, which is its own signal that they need to be
scheduled explicitly rather than left to "opportunistic" pickup again.

---

## 2. A new instance of the exact pattern Phase 7-9.1 was built to prevent

This is the most consequential finding in this retrospective, because it happened
*after* the fix, not before it.

🔴 **Filter bars and result summaries are hand-copied five times.**
`src/app/(public)/{programs,events,startups}/filters.tsx` each independently
implement the same `setFilter` / `hasFilters` / "Clear all" URL-search-param
logic — identical shape, only the option list and target route differ.
`resultSummary()` (count + pluralization + "match your filters" suffix) is
independently defined in `programs/page.tsx`, `events/page.tsx`,
`resources/page.tsx`, `startups/page.tsx`, and `mentors/page.tsx` — five copies of
the same four-line function.

This is the same shape of problem PHASE-5-6-RETROSPECTIVE.md §9 found in the
display-heading string (copied 35 times) and fixed in 7-9.1 by extracting
`Heading`. That fix visibly worked — `StatusBadge<T>` built in the same pass was
correctly reused for `AvailabilityBadge` in 7-9.6 rather than hand-copied a third
time. But the filter/summary pattern was introduced *fresh* across 7-9.3 through
7-9.6, in the same session, without the second-instance-should-prompt-extraction
discipline being applied to it. Two instances (events, programs) would have been
a coincidence; five is a pattern that should have triggered a
`useUrlFilter(paramKeys)` hook or a generic `<FilterBar>` component by the third.

🟡 **Empty-state copy strings are hand-copied, not centralized**, even though the
`EmptyState` *component* is correctly reused every time. "THE FIRST GENERATION IS
BEING BUILT." appears as a literal string in three files
(`startups/page.tsx`, `invest/page.tsx`, `built-with-knest.tsx`); the Resources
empty copy appears in three more. `CONTENT_SPEC.md §8` is the single source of
truth for this copy, but the code has no single source of truth mirroring it — a
future copy edit means finding and updating every hand-typed occurrence rather
than one constant.

Lower severity than the filter duplication because copy text drifting is more
self-evident (a proofreader would catch it) than logic drifting silently, but the
fix is nearly free: a `src/lib/empty-state-copy.ts` exporting the §8 table as named
constants.

---

## 3. A new accessibility gap of the same class already fixed once

🔴 **The journey selector's response panel isn't announced.**
`src/app/(public)/journey-selector.tsx` reveals a personalized response and CTA
when an option is selected — the interaction 7-9.10's own commit message called
"the potential killer feature" — but the reveal has no `aria-live` region or
`role="status"`. A screen reader user who activates one of the five radio buttons
gets no automatic announcement that new content appeared; they'd have to
manually re-navigate to find it.

This is the exact class of gap PHASE-5-6-RETROSPECTIVE.md §10 found and 7-9.1
fixed everywhere it was already visible (filter counts, save indicators). The
`LiveRegion` primitive built for that fix already exists and is imported
elsewhere in this same phase's own code (`NotificationsList`,
`resources/page.tsx`) — it simply wasn't reached for here. One-line fix: wrap the
response panel's content update in `<LiveRegion message={option.response} />`.

---

## 4. Architecture & domain boundaries

No violations found. Every new dashboard/public read in this phase resolves
`app`-schema data through the established `userId`-text-field link
(`Mentors.userId`, `Founders.userId`) rather than a join, and every CMS read
keeps `overrideAccess: false` with no user context — verified by re-reading
`src/server/content/{mentors,programs,startups,partners,infrastructure,articles,homepage}.ts`
in full, not sampled.

🟡 **`Partners.featured` doesn't exist, but three separate documents assume it
does.** `PHASE-7-9-IMPLEMENTATION-PLAN.md §4.6` and `§4.7` both describe "a live
pull of featured Partners" for `/invest` and the homepage ecosystem section. The
field was never added in Phase 2. This was caught and honestly worked around
three times independently (7-9.7, 7-9.8, 7-9.10 all list every published partner
instead) — each with its own code comment explaining the gap, which is the right
call for now, but three independent workarounds for one missing field is a sign
the field itself should either be added or the aspirational language removed
from the planning docs so it stops getting re-discovered.

⚪ **`Homepage.testimonials` and `Homepage.metrics` are unused by design, not by
oversight.** Neither field is consumed by any of the ten rendered sections — a
deliberate decision (documented in the 7-9.10 commit) because no section in
`CONTENT_SPEC.md §1` calls for rendering either, and `Testimonials`/`Metrics` both
require real, consented/sourced content that doesn't exist yet (spec §46). Noted
here only so a future reader doesn't mistake "unused global field" for "forgotten
integration."

---

## 5. Database schema

Clean. `eventRegistrations` (7-9.2) follows the established `app`-schema
conventions exactly: `uuid` text PK, FK to `users` with cascade delete, plain
integer (not FK) for the CMS-side `eventId`, and a unique composite index doing
the idempotency work rather than application-level locking. One migration file
(`0003_burly_venom.sql`) for one schema change — no drift, no orphaned
migrations.

🟡 **Still no `deletedAt` / archival convention** (PHASE-5-6-RETROSPECTIVE.md §3,
unchanged) and **still no policy for a deleted program with existing
applications** (§2, unchanged). Neither was exercised by this phase's own work,
so neither got worse, but neither got resolved either.

---

## 6. Server actions & API routes

Every new action in this phase follows the correct guard-family-per-context rule
that §1 of the 5-6 retrospective established: `registerForEvent`,
`unregisterFromEvent`, and `markNotificationRead` all use `requireUserOrThrow`
and are all called exclusively from route handlers that catch `UnauthorizedError`
— verified against `src/app/api/events/[id]/{register,unregister}/route.ts` and
`src/app/api/notifications/[id]/read/route.ts`. **Zero new instances** of the
guard-mismatch bug were introduced this phase; the one instance that exists
(`changeApplicationStatus`, §1 above) predates it.

`markNotificationRead`'s ownership check (query by both notification ID *and*
`userId`, return not-found rather than forbidden if they don't match) was
verified live: a second user's attempt to mark another user's notification read
correctly returns 400 "Notification not found" rather than leaking whether the ID
exists. Good pattern, worth carrying forward as the default for any future
per-user-scoped mutation.

🟡 **`getProgramById` (new, `src/server/content/programs.ts`) swallows every
error into `null`**, same as the pre-existing `getEventById` and
`getMentorBySlug` it was modeled on — a malformed ID and "not found" are
indistinguishable to the caller. Consistent with the codebase's existing
convention (not a regression), but worth deciding deliberately in Phase 10-12
rather than by precedent alone, since a silent `null` on a real database error
(connection drop, timeout) currently reads to the founder dashboard as "no
accepted program" rather than "something went wrong."

---

## 7. Notifications — read, but the fix didn't go all the way

✅ The core gap from PHASE-5-6-RETROSPECTIVE.md §6 is closed: `listNotificationsForUser`,
`countUnread`, and the dashboard's `NotificationsList` are the first UI in the
app to read the table, verified live end-to-end (a founder's application walked
through five status changes produced five real notifications, rendered with the
correct unread count, and marking one read updated `readAt` and the count without
a reload).

🟡 **Notifications are dashboard-only.** There's no unread indicator anywhere in
`SiteHeader` — a signed-in user only discovers they have unread notifications by
visiting `/dashboard`. Reasonable for a first cut (the dashboard *is* "what should
I do next," per CONTENT_SPEC.md §5), but worth deciding explicitly whether a
header badge belongs in Phase 10-12's scope or stays deferred.

---

## 8. Payload integration & performance

🟡 **A new N+1-shaped pattern: `TheJourney` makes seven parallel Payload round
trips for one homepage section.** `src/app/(public)/the-journey.tsx` calls
`listPrograms({ stage })` once per `STAGE_OPTIONS` entry inside a `Promise.all` —
parallelized, so not a latency multiplier the way the pre-existing sequential N+1
patterns are, but still seven separate queries where one `listPrograms({})`
followed by an in-memory `groupBy(stage)` would do the same job in one round
trip. Small at current program counts; worth fixing before Phase 10-12's
performance pass if the homepage becomes the primary landing surface it's
designed to be.

The three N+1 patterns named in PHASE-5-6-RETROSPECTIVE.md §8
(`listApplicationsForUser`, `listApplicationsForReview`,
`listProgramCohortsWithStartups`) and the redundant `getApplicationProgramBySlug`
round-trip are all unchanged — none were touched by this phase, so none
regressed, but none improved either.

⚪ No caching was added beyond React's per-request `cache()` dedup — same as
5-6, still fine at seed-data scale, still worth remembering for Phase 10-12.

---

## 9. Component reuse

Genuinely strong in the places this phase was explicitly asked to focus on:
`Timeline`, `Table`, `Avatar`, `StatusBadge<T>`, and `OptionList`'s relocation
were all built or reused correctly, with no visible duplicate primitive
introduced anywhere in 7-9.1 through 7-9.10's own new components. The failure
mode this phase has is the *opposite* one — not hand-copying a visual primitive,
but hand-copying **page-level logic** (filters, result summaries — §2 above) that
never got promoted to a shared hook or component the way visual primitives did.

🟡 **`hero.tsx`'s `<h1>` hand-copies `Heading`'s `display` size classes** instead
of rendering `<Heading as="h1" size="display" className="animate-rise-fade
whitespace-pre-line">`. One instance, not a pattern — but it's a literal
re-introduction of the exact string 7-9.1 spent a whole sub-phase removing 24
copies of, in the one file (the actual homepage hero) that was the original
motivating example for building `Heading` in the first place.

---

## 10. Responsive UI & accessibility

✅ The staff applications table's missing mobile fallback (5-6 §10) is fixed —
retrofitted onto the `Table` primitive in 7-9.1, which collapses to cards under
`sm:`. Confirmed by reading `src/app/(staff)/admin/applications/page.tsx`.

✅ `aria-live` regions exist and are used consistently across every new list page
built this phase (programs was already fixed; events, resources, startups,
mentors all carry the same `LiveRegion` + visible summary pattern).

🔴 See §3 above — the journey selector reveal is the one new gap.

🟡 **`TheJourney`'s horizontal scroll rail on mobile** (`overflow-x-auto` with
fixed-width cards) is a judgment call, not a violation — `UX_WIREFRAMES.md §8`'s
"mobile becomes cards, not horizontal scroll" rule was written about *tabular*
data (the staff applications queue), and a sequential stage progression is
arguably a legitimate horizontal-scroll use case (a carousel, not a table). Flagging
so it's a considered exception rather than an unnoticed one — if user testing in
Phase 10-12 says otherwise, it's a `md:flex-col` away from a stacked layout.

---

## 11. Testing

🔴 **Zero unit tests were added across all of Phase 7-9.** `pnpm test` still runs
exactly the three suites that existed before this phase
(`transitions.test.ts`, `roles.test.ts`, `recommend.test.ts`) — 20 tests, the same
20 as PHASE-5-6-RETROSPECTIVE.md §12 counted. Every new piece of pure, easily
testable logic this phase added shipped with zero automated coverage:
`availabilityRank`/`byAvailability` (mentor sort order), `enabledSections`'s
fallback logic (homepage.ts), and `pathHref` (student-view.tsx's
recommend-path-to-URL mapping) are all small, deterministic, dependency-free
functions — exactly the shape `recommend.test.ts` already proves this project
knows how to test well.

This repeats 5-6's own finding verbatim: "their only verification was the live
manual E2E walk... which was thorough but isn't repeatable." Every phase in this
project has now been verified live and by hand, and zero of that verification
has been captured as a script or test that would catch a regression on the next
phase. `scripts/verify-auth-boundary.sh` and `scripts/verify-auth-flows.sh` are
still the only two repeatable checks in the entire project, and neither was
extended to cover the new event-registration or notification-read authorization
boundaries this phase added, despite both being manually curl-verified during
the session.

**This is the clearest, most repeatable process gap across both retrospectives
now.** Recommend treating "write the test/script alongside the feature" as a
Phase 10-12 process change, not just a backlog of tests to add.

---

## 12. Naming consistency

No new inconsistencies found. The `{stage}` vs `{stages}` field-name mismatch
between `Startups`/`Programs` (singular) and `Resources`/`Events.relevantStages`
(plural/differently-named) that content-layer filters already had to work around
is pre-existing and was correctly worked around again in every new filter this
phase added (`listStartups`, `listMentors`, `listInfrastructure`) rather than
introducing a sixth naming convention.

---

## 13. Priority list for Phase 10-12

Ordered by what would hurt most if carried forward silently a third time:

1. **Actually fix the three named-twice-unfixed items**: the `review.ts` guard
   mismatch, `startApplication`'s idempotency race, `submitApplication`'s missing
   `applicationStatus` check, and wrapping both multi-step mutations in
   transactions (§1). These have now been on two consecutive priority lists
   without a commit against them — schedule them first, explicitly, not
   opportunistically.
2. **Extract the filter-bar and result-summary duplication** (§2) before adding
   a sixth list page that would otherwise become a sixth hand-copy — `/search`
   is explicitly Phase 10-12 scope and is exactly the kind of page that would
   perpetuate this pattern if it's not fixed first.
3. **Fix the journey-selector `aria-live` gap** (§3) — small, isolated, and the
   homepage is the highest-traffic surface in the product.
4. **Add the missing authorization-boundary script coverage** for event
   registration and notification-read (§11), and treat "ship the test/script
   with the feature" as a standing rule rather than a retrospective line item.
5. Everything marked 🟡/⚪ can ride along opportunistically inside Phase 10-12
   work without blocking it, same as 5-6's own list — with the explicit caveat
   that "opportunistic" is exactly how items 3-5 from that list survived two
   full phases untouched.
