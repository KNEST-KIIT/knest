# Phase 10-12 Retrospective — Search, Analytics, Security, Performance, Polish

> Same discipline as `PHASE-5-6-RETROSPECTIVE.md` and `PHASE-7-9-RETROSPECTIVE.md`:
> every finding below was verified by re-reading the actual files or testing live
> against a running server, not inferred from commit messages. This is the last
> phase in `PHASE-10-12-IMPLEMENTATION-PLAN.md`'s own build order — there is no
> Phase 13-15 this hands off to, so §9 below reads as launch-readiness rather than
> a priority list for a next phase.
>
> Severity: 🔴 fix before launch · 🟡 real but can wait · ⚪ noted, no action needed yet

---

## 1. The Phase 7-9 priority list, re-audited

Four items were carried into this phase with explicit priority (§13 of the 7-9
retrospective). Re-reading the actual code rather than trusting commit messages:

| # | Item | Status |
|---|---|---|
| 1 | Fix the three named-twice-unfixed application-engine bugs + transactions | ✅ Done — 10-12.1, `4df7f5d` |
| 2 | Extract the filter-bar and result-summary duplication before `/search` existed | ✅ Done — 10-12.2/10-12.3, `d9cfaf1` |
| 3 | Fix the journey-selector `aria-live` gap | ✅ Done — same commit |
| 4 | Add authorization-boundary script coverage for event registration and notification-read | ❌ **Still not done** |

Item 4 is the one carryover. `scripts/verify-auth-boundary.sh` and
`scripts/verify-auth-flows.sh` are unchanged from Phase 7-9; the new
`scripts/verify-application-flow.sh` (10-12.1) covers the application-engine
fixes it was written for, but neither `registerForEvent`/`unregisterFromEvent`
nor `markNotificationRead` gained script coverage — both are still verified only
by the live curl checks described in commit messages, which is exactly the
"thorough but not repeatable" gap named twice now. Unlike items 1-3, this one
wasn't attempted and abandoned — it simply never came up as a discrete task
across ten sub-phases, which is itself worth noting: naming something on a
retrospective's priority list doesn't guarantee it becomes a tracked task unless
it's written into the next phase's own implementation plan (it wasn't — §2's
gate section listed only items 1-3).

Items 1-3 are genuinely fixed, not just touched. `startApplication`'s
idempotency was re-verified live under real concurrency (two parallel curl
requests, same `applicationId` returned) as part of *every* subsequent
sub-phase's verification pass in this phase, not just 10-12.1's own — the
regression-check discipline actually held for the rest of the phase, which is
new; Phase 7-9 didn't re-verify Phase 5-6's fixes at each step the way this
phase re-ran `verify-application-flow.sh` after every commit.

---

## 2. A repeat of the "fix once, but the pattern reappears" class of finding

This is the same shape §2 of the 7-9 retrospective described (the filter-bar
duplication reappearing after `Heading` had already fixed the same class of
problem once) — and it happened again in this phase, in a way worth calling out
explicitly because of where it hid.

🔴 **`EmptyState` hardcoded an `h3` heading, unconditionally, across all fifteen
of its call sites** — found by 10-12.9's own Lighthouse/axe pass, not designed in
from the start. Four public list pages (`startups`, `events`, `resources`,
`mentors` — `programs` too, before the fix) skip straight from `h1` to `h3`
whenever the list is empty, because `EmptyState`'s heading was always `h3`
regardless of whether an `h2` existed anywhere on the page. Given
`CONTENT_SPEC.md`'s own words about the platform's launch state — "almost no
content" — this is not an edge case; it is close to the default rendering path
for every list page at launch. Fixed in 10-12.9 by giving `EmptyState` a
`headingLevel` prop (default `h2`), with five genuinely-nested call sites
(dashboard views, `/invest`, `/ecosystem`) opted into `h3` explicitly.

The instructive part: `EmptyState` itself is a correctly-reused, single
component (7-9's own retrospective praised the *component* as consistently
reused, and it still is — fifteen call sites, one implementation). The
duplication this time wasn't a hand-copied component; it was a **hardcoded
assumption inside a shared component** that happened to be wrong for the
context it's used in most. Component reuse and correctness are different axes,
and this phase's tooling (Lighthouse/axe, run for the first time against real
pages in 10-12.9) is what caught it — nothing in the code review discipline
used through 10-12.1-10-12.8 would have, since every individual call site
*looked* fine in isolation.

🟡 **`dashboard/applications/page.tsx`'s populated-state application-card
headings had the identical `h1→h3` skip**, independent of `EmptyState` — found
and fixed in the same pass. Two independent instances of the same specific skip
(`h1` then straight to `h3` for a list's row/card titles) suggests this was a
genuine, easy-to-make mistake given `Heading`'s three-tier `display/title/heading`
sizing doesn't map 1:1 onto semantic heading *level*, and nothing enforces the
correspondence. Worth a lint rule or a code-review checklist item if this
codebase gets another phase of new list surfaces; not urgent to build now since
axe now covers every public route and would catch a new instance immediately —
see §8.

---

## 3. Two bugs that only a real production build could have found

Both of these are described in detail in the 10-12.9 commit message; they're
repeated here because they're the most consequential findings of the whole
phase and belong in the retrospective's own record, not just a commit body.

🔴 **`sessionCookieName()` decided the `__Secure-` prefix from `NODE_ENV`;
Auth.js's own `auth()` decides it from `AUTH_URL`'s protocol.** This repo's own
`.env`/`.env.example` ship `AUTH_URL=http://localhost:3000`. Every login against
a `NODE_ENV=production` build would set a cookie name `auth()` could never read
back — a 100%-reproducible, silent, total login failure, never caught because
every verification script and every manual test all session ran against
`pnpm dev`, never a production build, until 10-12.9 explicitly required it.
Fixed in `src/server/auth/session.ts` by deriving the same signal Auth.js uses.

🔴 **`output: 'standalone'` was configured with nothing to copy `.next/static`
into the standalone output.** Next.js's own docs are explicit that this is a
required manual step; without it, the standalone server (what the README says
this app actually deploys as — ECS behind an ALB) serves every page with no CSS
and no client JS. This is not a subtle bug: a real user hitting the real
deployment target as configured would see broken layout on every request and no
interactive functionality anywhere. `package.json` gained a `postbuild` script
that runs the copy automatically; README documents it and the correct start
command (`node .next/standalone/server.js`, not `next start` — the latter warns
it's incompatible with `output: 'standalone'` and, verified live, silently
reads a different session-cookie signal than the standalone server does).

**Both bugs share one root cause worth naming directly: nothing in this
project, across all twelve phases, had ever run the actual production build the
way it would actually be deployed.** `pnpm dev` was the verification environment
for every prior phase's live testing. Lighthouse/axe (10-12.9's own scope) is
what forced a production build to finally get exercised end-to-end — and it
immediately found two bugs severe enough to make the app entirely non-functional
in production. This is the single most important process finding in this
retrospective: **"verified live" has meant "verified against `next dev`" for the
whole project**, and that verification method has a blind spot big enough to
hide a total outage.

---

## 4. Security

🟢 The three named 10-12.6 items (rate limiting, file-content verification,
CSP) were built and verified live, including the acceptance-criteria-specific
checks the plan named (exactly the sixth login attempt gets 429, a renamed
`.pdf` with mismatched magic bytes is rejected, `/admin` renders correctly with
CSP enforced).

🔴 **Found and fixed within the same phase, not carried forward**: the
`applicationStart` rate limit was originally enforced on every call to
`startApplication`, including the idempotent re-fetch `/apply/[program]`'s page
component makes on *every visit* to an already-started application — a user who
reloaded the page more than five times within fifteen minutes would get rate-
limited out of their own in-progress application. Caught live while testing
10-12.8 (fifteen reloads tripped a 500), fixed by only enforcing the limit when
no draft already exists for that user+program. Flagging this here rather than
treating it as fully resolved-and-forgotten: it's a reminder that adding a rate
limit to a function called from multiple call sites needs each call site's
actual usage pattern checked, not just the one route the plan named.

⚪ **The IP key for anonymous rate limits (`login`, `signup`,
`password-reset`) relies on `x-forwarded-for` alone**
(`src/server/security/rate-limit.ts`'s `clientIp()`), with `'unknown'` as the
fallback when absent. In this session's own sandboxed test environment, that
header turned out to always be present and consistent (`127.0.0.1`), so the
fallback path was never actually exercised end-to-end. Worth being aware of
before relying on this in a real deployment: if the ALB/ECS setup the README
describes doesn't reliably set `x-forwarded-for` (or a misconfigured proxy
strips it), every anonymous client collapses into one shared `'unknown'` bucket
and one abusive client's failed logins would rate-limit every anonymous visitor.
Not verified either way in this session — noted as an assumption, not a
confirmed bug.

---

## 5. Database schema

Clean, same conventions held. `analytics_events` (10-12.5) is the one schema
addition that deliberately breaks from every other `app`-schema table's FK
convention — `userId` is `onDelete: 'set null'`, not `cascade` — and that
divergence is intentional and documented inline (a funnel count should survive
account deletion). `rate_limits` (10-12.6) correctly has no FK at all, since its
`key` is IP-or-userId text, not a stable reference. Two migrations
(`0004_puzzling_stone_men.sql`, `0005_warm_outlaw_kid.sql`), one per schema
change, no drift.

🟡 Still no `deletedAt`/archival convention (named unchanged in both prior
retrospectives) and still no policy for a deleted program with existing
applications. Neither was exercised by this phase either.

---

## 6. Performance

✅ All four named items from §5 of the 7-9 retrospective and §5 of the
implementation plan are fixed and verified with real query-count instrumentation
(temporarily added, removed before commit, per the plan's own acceptance
criteria): `TheJourney`'s seven parallel queries collapsed to one;
`listApplicationsForUser`/`listApplicationsForReview`/
`listProgramCohortsWithStartups`'s N+1 patterns batched into one query each;
`getApplicationProgramBySlug`'s redundant second round-trip removed;
`getProgramBySlug`'s `depth: 2` right-sized to `depth: 1` after checking the
page's actual field usage.

No new N+1 patterns were introduced by this phase's own new code
(`getProgramTitlesByIds`, the funnel report's two queries, the search
function's four parallel `payload.find` calls) — all were written batched from
the start, which suggests the pattern is now understood rather than just
patched reactively.

---

## 7. Testing

🔴 **Still zero unit tests added.** `pnpm test` runs the same three suites named
in both prior retrospectives — `transitions.test.ts`, `roles.test.ts`,
`recommend.test.ts` — 20 tests, unchanged since Phase 5-6. This phase added
several small, pure, dependency-free functions that are exactly the shape this
project already knows how to test well: `checkRateLimit`'s token-bucket math
(`src/server/security/rate-limit.ts`), `verifyFileContents`'s MIME-mapping logic
(`src/server/security/file-verify.ts`), `resultSummary()`, `formatAnswer()` (the
value→label resolver added twice, in the applicant and staff review views), and
`slugify()`. None have a unit test. This is the third retrospective in a row to
name this exact gap with an almost identical sentence, which is itself the
finding: naming it in a retrospective has not been sufficient to change the
pattern across three phases.

🟢 What *did* improve, concretely: `scripts/verify-application-flow.sh`
(10-12.1) is the first script added since `verify-auth-flows.sh` in Phase 3, and
it was re-run after most subsequent sub-phases as a regression check — a real,
if narrow, instance of the "ship the test alongside the feature" rule the 7-9
retrospective asked for. It just wasn't extended to the newer surfaces (events,
notifications — §1 above) or turned into unit tests for the new pure functions
this phase added.

🟢 10-12.9 is the first phase-ending pass that used automated tooling
(Lighthouse, axe) instead of purely manual/live verification for its own
category of checks (accessibility, performance, SEO) — and, per §3 above, it's
also what caught the two most serious bugs of the whole phase. That's a strong
argument for the same thing being true of unit tests for pure logic: automated
checks caught what manual verification's blind spots missed, twice, in this
phase alone.

---

## 8. What Lighthouse/axe becoming real changes going forward

`lighthouse` and `@axe-core/playwright` are now `devDependencies`, used for the
first time in 10-12.9. Nothing wires either into a repeatable script the way
`verify-auth-flows.sh` wraps curl checks — both runs in this phase were ad-hoc
Playwright scripts written for the occasion and discarded. If another phase adds
public routes, there's now proven tooling but no `scripts/verify-a11y.sh`
equivalent to re-run it without re-deriving the same Playwright boilerplate.
Given §2's finding (axe caught a defect that fifteen call sites' worth of
individually-reasonable-looking code review missed), this is worth turning into
a real script rather than leaving it as "ad-hoc when someone remembers."

---

## 9. Launch readiness — what's actually left

This phase closes `PHASE-10-12-IMPLEMENTATION-PLAN.md`'s own build order in
full; there is no next phase this hands off to in the current plan. What
remains, ordered by risk if shipped as-is:

1. **Verify the real deployment target end-to-end, not just the standalone
   build locally.** §3's two bugs were caught by running `node
   .next/standalone/server.js` against `AUTH_URL=http://localhost:3000` and a
   locally-forged `x-forwarded-for`. Neither TLS termination, a real
   `AUTH_URL=https://...`, nor the actual ALB's header behavior have been
   exercised. Given how severe the two bugs already found were, treat "deploy
   to a real staging environment and click through the golden path" as a
   blocking step before launch, not an optional nice-to-have.
2. **The rate-limit IP-key assumption (§4)** should be confirmed against the
   real ALB/ECS header behavior before relying on it — a wrong assumption here
   fails safe-ish (over-restrictive, not a security hole) but could lock out
   every anonymous visitor if `x-forwarded-for` isn't what's expected.
3. **Turn 10-12.9's Lighthouse/axe passes into a script** (§8) so the next
   change to a public route gets checked automatically instead of only when
   someone remembers to run it by hand again.
4. **Add unit tests for the pure functions this phase and the last two added**
   (§7) — the specific list is in that section. This is the third
   retrospective to name this same gap; if it's not going to happen
   incrementally, it's worth a single, explicit pass rather than another
   deferral.
5. **Decide on `Partners.featured`** (named in the 7-9 retrospective, still
   unresolved) — either add the field or remove the aspirational language from
   the planning docs. Untouched by this phase; not urgent, but it's now been
   independently re-discovered by three separate sub-phases across two
   different phases.
6. Everything marked 🟡/⚪ above can reasonably ship as-is — none block launch
   the way items 1-2 do.
