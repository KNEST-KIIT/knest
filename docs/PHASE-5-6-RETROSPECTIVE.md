# Phase 5-6 Retrospective — Programs & the Application Engine

> A grounded audit of the shipped code, not a recap of the commit message. Every
> finding below was verified by re-reading the actual files or testing live against
> a running server — several contradict what the Phase 5-6 commit message claimed
> was solid. Findings are scoped to what materially affects correctness, security,
> maintainability, UX, or Phase 7-9 — not style preferences.
>
> Severity: 🔴 fix before or during Phase 7-9 · 🟡 real but can wait · ⚪ noted, no action needed yet

---

## 1. The one confirmed bug: an authorization-error contract violation

🔴 **`review.ts`'s staff-facing functions use the wrong guard for where they're called from.**

Two guard families exist, built for two different call contexts (`src/server/auth/guards.ts`):

| Guard | Failure mode | Correct for |
|---|---|---|
| `requireStaff()` / `requireAdminArea()` | calls Next's `notFound()` | **page components** — Next renders the not-found UI |
| `requireStaffOrThrow()` | throws `UnauthorizedError` | **route handlers** — caller's `catch` turns it into JSON |

`listApplicationsForReview`, `getApplicationForReview`, and `changeApplicationStatus`
(`src/server/applications/review.ts`) all call `requireAdminArea('applications')` —
correct for the two page components that use the first two, **wrong** for
`changeApplicationStatus`, which is also called from
`src/app/api/admin/applications/[id]/status/route.ts`, a route handler.

Verified live rather than assumed:

```
$ curl -i -b student.jar -X POST .../api/admin/applications/.../status
HTTP/1.1 404 Not Found
                                          ← empty body, no JSON

# contrast with the document-download route, which uses requireStaffOrThrow correctly:
$ curl -i -b student.jar .../api/admin/applications/.../documents/x
HTTP/1.1 403 Forbidden
```

Not a security hole — 404 still denies access, nothing leaks. But it breaks the
route's own JSON contract: the client does
`res.json().catch(() => ({}))`, so `data.error` silently becomes `undefined` and
the staff member sees a generic fallback message instead of "Not permitted." The
real risk is what this pattern invites in Phase 7-9: more shared server functions
called from both pages and routes will repeat this the same way unless the rule is
made explicit.

**Fix:** `changeApplicationStatus` should take an already-authorized staff user as a
parameter rather than re-deriving it, so the route handler calls
`requireStaffOrThrow('applications')` itself (matching the document-download route)
and passes the result in — one guard call per request, the right kind for where the
request originated.

---

## 2. Architecture & domain boundaries

**Holds up:** the `cms`/`app` schema split from Phase 2 is respected throughout —
`programId` on `applications` is a plain integer, not a Postgres FK, exactly per the
documented reasoning (Payload and Drizzle migrations stay independent). Module
boundaries (`applications/`, `notifications/`, `storage/`, `content/`) are clean and
each has one job.

🟡 **`ApplicationQuestion` is hand-duplicated, not derived, from Payload's generated
type.** `src/server/applications/types.ts` manually re-declares the shape of
`Program['applicationQuestions'][number]` instead of
`type ApplicationQuestion = NonNullable<Program['applicationQuestions']>[number]`.
Payload regenerates its types automatically when the collection changes
(`pnpm generate:types`); this hand copy does not. A field added or renamed on the
real collection can silently diverge from what `schemaForQuestion` validates
against. Low cost to fix, meaningful drift risk to leave.

🟡 **No policy for a deleted program with existing applications.** The `app`/`cms`
split means Postgres can't enforce this with a foreign key (by design), but nothing
in code enforces it either — a staff member can hard-delete a published program in
Payload while applications reference its id. Read paths degrade gracefully
(`programTitle: program?.title ?? 'Unknown program'`), so nothing crashes, but an
applicant's own status page would show "Unknown program" with no explanation, and
staff get no warning before deleting. Needs either a soft-delete/archive convention
on Programs, or a pre-delete check in the admin UI — a product decision, not just a
code fix.

---

## 3. Database schema

Solid: correct indexes throughout (`applications_user_program_idx` as a unique
constraint doing double duty as the idempotency guarantee for "start", status and
program lookups indexed, audit log indexed by entity). UUID text primary keys and
`jsonb` for variable-shaped answers are the right calls given the CMS-configured
question set.

🟡 **No `deletedAt` / archival convention anywhere in the `app` schema.** Not urgent
for this slice, but Phase 7-9's dashboard will want to distinguish "nothing to show"
from "there was something, it's gone" — worth deciding before more tables assume
hard deletes are fine.

---

## 4. Server actions — state integrity

🔴 **`startApplication`'s idempotency isn't atomic.** It checks for an existing
application, then inserts if none exists — a classic check-then-act race. Two
concurrent requests (a double-click, two tabs) can both pass the check as empty and
both attempt the insert; the unique index (`applications_user_program_idx`) will
reject the second one with a raw Postgres `unique_violation`, which nothing catches.
That request 500s instead of gracefully returning the now-existing application id.
Narrow window, but a real bug — fix with
`.onConflictDoNothing().returning()` and a re-query on empty result, or wrap in a
transaction.

🔴 **`submitApplication` checks the deadline but not `applicationStatus`.** A staff
member can flip a program to `closed` mid-cohort without setting a deadline (the
`applicationDeadline` field is optional and only shown in the admin UI when
`applicationStatus === 'open'`). An applicant with an existing draft can still
submit successfully after that, because submit only checks
`program.applicationDeadline`, never `program.applicationStatus`. Two independent
"is this still open" signals exist and only one is checked at the moment it matters
most.

🔴 **No transactions around multi-step mutations.** Both `submitApplication`
(status update → `notify()`, which itself does an insert → an email send) and
`changeApplicationStatus` (status update → audit log insert → `notify()`) run as
sequential, unwrapped statements. `notify()`'s own notification-row insert is
**not** caught (only the email send has a `.catch()`) — if that insert throws, the
exception propagates up *after* the application or audit state already committed.
Two concrete failure modes:
- A crash between the status update and the audit-log insert leaves a status
  change with **no audit trail** — silently defeating the log's stated purpose
  ("every staff mutation of consequence," per its own doc comment).
- A crash in `notify()`'s DB insert makes `submitApplication` return an error to
  the client even though the application was already marked `submitted` — the
  applicant sees a failure for something that actually succeeded.

Fix: wrap each of these in `db.transaction()`.

🟡 **`submitApplication`'s own transition bypasses the transition table.** The
draft → submitted move is hardcoded (`status: 'submitted'`) rather than routed
through `isLegalTransition('draft', 'submitted')` the way every staff-triggered
transition is. Today this is harmless — draft → submitted is genuinely the only
legal first move — but it means the single source of truth for "what transitions
are legal" has one silent exception. If the state machine ever grows a required
step before submission counts, this call site won't respect it.

⚪ **Uploaded files are never cleaned up.** Re-uploading for the same question
overwrites the DB row (`onConflictDoUpdate`) but the old blob at the old storage key
is never deleted — orphaned files accumulate in both local dev storage and
(eventually) S3. Acceptable for this slice; needs a cleanup path before real usage.

---

## 5. API routes & authorization

Beyond the one confirmed bug in §1: the *pattern itself* — throwing
`UnauthorizedError` in every applicant-facing action
(`requireUserOrThrow`) and catching it uniformly at each route — is correct and was
followed consistently across all four applicant routes
(`start`, `answer`, `documents`, `submit`). The file-upload route also correctly
checks `file.size` before calling `.arrayBuffer()`, avoiding buffering an oversized
file into memory before rejecting it — this was a bug caught and fixed during Phase
5-6 itself, and it held up on re-read.

🟡 **File content isn't verified past its declared MIME type.** `Content-Type` is
client-supplied and can be spoofed; nothing inspects the actual file bytes (magic
number sniffing) before storing it. Reasonable to accept for V1 — flagging so it's a
documented, deliberate gap for Phase 10-12 (security hardening) rather than an
implicit one.

---

## 6. Notifications — written, never read

🔴 **The `notifications` table has zero read call sites outside the module that
writes it.** Confirmed by grep: every application-lifecycle event correctly writes a
row (verified live — shortlisting an application produced the right email and the
right DB row), but nothing in the UI — no bell icon, no list, no unread count —
ever queries it back. All of Phase 5-6's in-app notification work is currently
invisible to a user; `/dashboard/applications` shows status by reading
`applications.status` directly, never touching `notifications` at all.

This is the most consequential finding for Phase 7-9: the dashboard's whole job is
answering "what should I do next," and unread notifications are an obvious, already-
built data source for that — sitting unused.

---

## 7. Application state machine

The strongest part of Phase 5-6. `src/server/applications/transitions.ts` is a
single, small, pure lookup table; 20 tests exercise every pair including illegal
jumps and terminal-state dead ends. Verified live: a `submitted → accepted` attempt
was correctly rejected by the server before any test suite ran. The one gap
(§4, submit bypassing the table for its own transition) doesn't undermine the
design — it's a call-site inconsistency, not a flaw in the table itself.

---

## 8. Payload integration

The `overrideAccess: false`, no-user-context pattern in `src/server/content/` and
`src/server/applications/program-questions.ts` is correct and consistently applied —
draft content structurally cannot leak to a public read, verified by construction
and by the E2E test (an unpublished program never appeared in `/programs`).

🟡 **N+1 Payload reads, in three places:** `listApplicationsForUser`,
`listApplicationsForReview`, and `listProgramCohortsWithStartups` each fetch one
program (or one startup list) per row inside a `Promise.all(rows.map(...))` rather
than batching. Fine at seed-data scale; will start to matter once a program has a
real cohort count or the review queue has real volume — worth batching (a single
`where: { id: { in: [...] } }` fetch, cached by id) before Phase 7-9 adds more list
views that follow the same shape.

🟡 **`getApplicationProgramBySlug` does a redundant second Payload round-trip.** It
finds the program by slug (getting the full document back), then discards it and
calls `getApplicationProgram(id)`, which fetches the *same document again* by id.
Trivial fix: map the already-fetched document directly.

⚪ **`depth: 2` on `getProgramBySlug`** is more relationship depth than the page
visibly uses (mentors' own relationships, partners' own relationships). Not wrong,
just unmeasured — a Phase 10-12 performance pass, not now.

---

## 9. Component reuse — confirms the concern that prompted this retrospective

This is where the evidence most directly supports slowing down before Phase 7-9.

🔴 **The display-heading utility string is hand-copied 35 times.**
`font-[family-name:var(--font-display)] ... uppercase` (with varying size/weight
tokens) appears independently in program pages, the apply flow, admin pages,
onboarding, dashboard, and auth screens — despite `SectionHeading` already existing
in `src/components/ui/section.tsx` since Phase 1. It's used in exactly **3** of the
many eligible places. Every Phase 5-6 screen that needed a heading reached for raw
Tailwind classes instead of the primitive already on hand.

🔴 **No `Table`, `Avatar`, or `Dialog` primitive exists.** `Table`: only one raw
`<table>` exists so far (staff applications queue) so it hasn't *compounded* into
duplication yet, but Phase 7-9's dashboard, mentor directory, and startup listings
are exactly the kind of list-heavy surfaces that will reach for a table or a
photo-bearing card next, with nothing shared to reach for. `Avatar` in particular
will be needed immediately — mentor cards, founder profiles, and "welcome back,
[name]" all want a consistent circular-photo-with-initials-fallback treatment, and
nothing like it exists.

⚪ **Status-badge logic is duplicated once, not yet a pattern.**
`ProgramStatusBadge` and `ApplicationStatusBadge` are two small, separately-written
`Record<string, {label, tone}>` lookup components with the same shape. Fine at two
instances; a third status-bearing entity (event registration status? cohort
status?) in Phase 7-9 should prompt extracting a shared `StatusBadge<T>` instead of
writing a fourth copy.

---

## 10. Responsive UI & accessibility

🟡 **The staff applications table has no mobile fallback.** Just
`overflow-x-auto` on a four-column `<table>`. This directly contradicts a rule
*already written* in `UX_WIREFRAMES.md §8* ("Mobile becomes cards, not a
horizontally scrolling table") — the rule exists, it just wasn't applied to the
staff surface when that table was built. Lower priority since staff work skews
desktop, but it's an inconsistency against the project's own spec, not an oversight
with no precedent.

🔴 **No `aria-live` region exists anywhere in the app.** Confirmed by grep — zero
matches. `UX_WIREFRAMES.md §3` explicitly specifies the program-filter result count
should be an announced live region; §13's accessibility checklist lists "live
regions for async changes (filter counts, save indicator, submit result)" as a
requirement. None of the three exist: not the programs filter count, not the
application form's "Saved automatically" indicator, not the submit outcome. This is
a real, specified requirement that Phase 5-6 didn't meet, not a new ask.

Everything *inherited* from Phase 1 primitives (`Field`'s `aria-describedby`/
`aria-invalid` wiring, focus rings, the accessible option-list radio/checkbox
pattern reused from onboarding into the application form) held up correctly on
re-read — the gap is specifically in async-state announcement, which no primitive
from Phase 1 covers yet.

---

## 11. Performance

No caching beyond React's per-request `cache()` dedup (which only prevents
duplicate fetches *within one render*, not across requests). Every page load re-hits
Payload and Postgres fresh. Combined with the N+1 patterns in §8, this is fine at
current scale and not worth addressing before Phase 7-9 — noted so it isn't
forgotten by Phase 10-12.

---

## 12. Testing

20 tests, all for the transition table — and they're good tests, directly
responsible for confirming §7's confidence. But that's the *only* unit-tested
logic in the entire application engine. `schemaForQuestion` (the validation logic
every applicant answer passes through), the ownership-check functions
(`loadOwnedApplication` and its callers), the notification-template generation, and
the storage abstraction all have **zero** unit tests — their only verification was
the live manual E2E walk during Phase 5-6, which was thorough but isn't repeatable
the way `scripts/verify-auth-boundary.sh` and `scripts/verify-auth-flows.sh` are.
No equivalent `scripts/verify-application-flow.sh` was written despite the manual
test script used during that phase being straightforwardly reusable as one.

---

## 13. Naming consistency

Mostly clean (consistent camelCase/snake_case conventions via Drizzle's explicit
column-name arguments, consistent `Result`-suffixed return types). One real
inconsistency:

🟡 **CMS question options have no stable `value` distinct from their `label`.**
`src/payload/fields/taxonomy.ts` establishes a `{label, value}` pattern everywhere
else in the CMS (sectors, stages, expertise areas). The `applicationQuestions.options`
field on Programs only has `{label}` — `schemaForQuestion`'s select/multiselect
validation checks answers against option **labels**. If a program manager edits an
option's label after applicants have answered against the old one, there's no way
to distinguish "the same choice, renamed" from "a different choice" — because there
was never a stable identifier for the choice, only its display text. Same
inconsistency, same fix pattern already established elsewhere in the codebase.

---

## 14. Priority list for Phase 7-9

Ordered by what would hurt most if carried forward silently:

1. **Design system consolidation** — `SectionHeading` adoption, plus new `Table` and
   `Avatar` primitives — before writing any more UI (§9). This is the direct
   prerequisite for the design-system audit the Phase 7-9 plan needs to start from.
2. **Surface notifications in the dashboard** — the data already exists; Phase 7's
   entire mandate ("what should I do next") is currently unmet by a table that's
   already fully wired to write to (§6).
3. **Fix the guard-pattern inconsistency** in `review.ts` before adding more shared
   server functions that will be called from both pages and routes (§1).
4. **Wrap the multi-step mutations in transactions** — `submitApplication` and
   `changeApplicationStatus` (§4).
5. **Close the `applicationStatus` gap on submit**, and make `startApplication`'s
   idempotency atomic (§4).
6. **`aria-live` regions** for filter counts, save indicators, and submit outcomes —
   a written, unmet requirement, not a new one (§10).
7. Everything marked 🟡/⚪ can ride along opportunistically inside Phase 7-9 work
   without blocking it.
