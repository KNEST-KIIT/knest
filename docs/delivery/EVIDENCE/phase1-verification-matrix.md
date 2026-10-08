# Phase 1 verification matrix

Branch `delivery/p1-containment`. Environment for every "verified" below: an **ephemeral PostgreSQL 16.14** started in a temp directory (no shared or production database), migrated from empty with the committed migrations, serving the **production build** (`next start`, Next 16.4.0, Payload 3.90.2) on a loopback port, with a stub SMTP server and a real system Chrome driven by Playwright. This is **not staging and not production**; neither exists yet.

## Final runs (HEAD of the branch, 2026-10-08)

| Suite | Result |
|---|---|
| `pnpm lint` (src + tests) | 0 errors, 26 warnings |
| `pnpm typecheck` | clean |
| `pnpm test` (unit) | **15 files, 194 tests, all pass** (baseline: 3 files, 20 tests) |
| `pnpm audit --prod --audit-level=moderate` | exit 0; 1 high + 1 moderate, both ignored by GHSA id (no patch exists) |
| `pnpm build` | exit 0 |
| `pnpm test:integration` | **10 files, 104 passed, 1 expected failure, 0 failed** (344 s) |

The one expected failure is `KN-22c (OPEN)`: it asserts that rotating `X-Forwarded-For` does not bypass the rate limit, and it currently does, so the test is marked `it.fails`. When the key is fixed the test will start passing and vitest will flag the marker.

## Original acceptance criteria -> evidence

| Task | Original closing criterion (blueprint Part D / I) | Evidence | Result | Gap |
|---|---|---|---|---|
| **C-03** | Anonymous `GET /api/lab-bookings` returns 403/empty | `10-anonymous-api` (9): the sentinel booking exists in the DB; anonymous is refused (401/403) and the body contains neither the e-mail nor the user id; filter probes by `userEmail`/`userId`/`sort` and `/api/lab-bookings/1` leak nothing; anonymous POST refused; the infrastructure join leaks nothing. `20-roles-and-media`: reviewer, content_admin, program_manager, startup_manager, mentor_manager, student refused; super_admin and lab_admin allowed. | **PASS** | Live deployment unchanged |
| | *Test is not vacuous* | Mutation: the original `lab-bookings.ts` restored, rebuilt, suite re-run -> 2 failures ("is refused and leaks nothing", "cannot probe the hidden fields"); restored afterwards | **PASS** | |
| **C-02** | Unit tests for empty vs error; visual check of each list page against an empty CMS | `lists.test.ts` (38): empty -> `[]`, failure -> throws, no substitute data, anonymous-scoped. `05-empty-cms` (22): the database is verified empty; each of `/programs /startups /mentors /events /resources /blog` shows its honest empty state; 11 pages contain none of 20 invented strings; former fallback slugs are not pages; the homepage shows the spec hero and "Programs for this stage are being built."; no Blog link in the nav; publishing a real program makes it appear. `content-integrity.test.ts`: no `FALLBACK_*` constant and no listed claim anywhere in `src` | **PASS (technical)** | HTML assertions, not screenshots. **HD-04 copy sign-off is an institutional gate, still open.** |
| **C-05** | `NODE_ENV=production` without a password exits; existing admin hash unchanged after reseed | `50-seeds` against the real DB: default password allowed locally; re-run with a different password leaves the hash identical; staff-edited homepage copy preserved; `SEED_RESET_EXISTING=true` is the only way to change an account; production without a password refused and creates nothing; the published default refused as an explicit password; the test student exists outside production only. Plus 13 policy unit tests | **PASS** | |
| **C-07** | Reviewer cannot update media | `20-roles-and-media` over real REST with session cookies: anonymous, reviewer, program_manager, startup_manager, mentor_manager, lab_admin refused; content_admin and super_admin upload a PNG and sharp produces sizes; SVG, HTML and XML refused even for super_admin; a reviewer cannot PATCH or DELETE existing media; `POST /api/staff/unlock` refused for super_admin | **PASS** | |
| **C-08** | Redirect validated; unknown-event rejected, over-limit 204; login timing | `30-auth-and-redirects` in real Chrome: `//evil.example`, `/\evil.example`, `https://evil.example`, `javascript:`, tab-obfuscated variant -> always same origin and no request to the foreign host; legitimate `next=/programs` honoured; sign-up with a hostile `next` ends on `/onboarding`. Login timing (cost-12 hashes): unknown e-mail within 0.6x-1.7x of a known one. `40-analytics`: forged `application_accepted`/`submit`/`signup`/`onboarding_completed` and a 300-char name -> 400 and zero rows; malformed -> 400; oversized -> 413; the allowed event stored with props narrowed to scalars (nested dropped, 500 chars cut to 64); a 75-request flood from one address -> at most 60 stored, the rest 204 | **PASS** | KN-22c (spoofable key) open |
| | *Not vacuous* | Mutation: the original redirect line restored, rebuilt -> 3 failures (`//evil`, `/\evil`, tab variant followed) | **PASS** | |
| **C-06** | Audit clean of criticals; golden path passes on the upgraded stack | Audit: 4C/21H/23M/7L -> 0C/0H/0M after the two ignores. Regression: admin UI renders for reviewer/content_admin/super_admin and is 404 for anonymous and students; sharp resizes; nodemailer 10 delivers over SMTP with the configured sender; sign-up -> mailed absolute link -> verify (single use); program manager publishes a program over REST, a reviewer cannot; student starts (idempotent), submits (once), reviewer moves it forward, illegal transition refused, audit row and notification written | **PARTIAL** | **Document upload** (production refuses local disk; needs S3), real SMTP/SES, interactive admin editing, staging. Kept IMPLEMENTED. |
| **C-04** | Guard fails closed | `guards.test.ts` (6): null in development, production and test; Next control-flow errors pass through | **PASS** | |
| **C-01** | Lint runs; tests green | `pnpm lint` and `pnpm check` | **PASS** | |

## Next-batch items

| Item | Evidence | Result |
|---|---|---|
| KN-04 migrations | Migrate an empty DB with `tsx src/db/migrate.ts` then `payload migrate` as NODE_ENV=production (done at the start of every integration run); re-run is a no-op; `payload migrate:create --skip-empty` finds no drift; both migration trackers are populated | PASS locally. **Not yet in CI; no populated-database upgrade rehearsal.** |
| NF-04 `lab_admin` | A user with the role can be stored; unit test ties `roles.ts` to the enum | PASS |
| KN-14 | Real Chrome: sign-up with `next=/apply/<slug>` -> six onboarding steps -> lands on the application; without `next` -> `/events` or `/programs`; hostile `next` ignored; a forced failure of the final call shows its message, stays on `/onboarding` | PASS |
| KN-15 | `/login` and `/signup` contain no Google button or Google link when unconfigured | PASS (disabled state only) |
| KN-31 / KN-13 (submit) | Unit (9): stale answers rejected. Integration: a CMS edit that removes an option blocks submit naming the question, and submit succeeds after fixing it; **10 simultaneous submits -> exactly one 200, nine refusals, one notification** | PASS |
| KN-17 / KN-08 | Student and founder dashboards render without the invented progress; lab booking renders none of its UI while the flag is off | PASS |
| NF-08 | Unknown URLs return 404 with the KNEST page | PASS (`global-error` untested) |

## Failed tests along the way (and what they were)

| Failure | Cause | Resolution |
|---|---|---|
| Payload dev-mode schema push hung and timed out in the harness | Interactive push cannot run unattended | Replaced by committed migrations (a real KN-04 fix) |
| `payload migrate` failed on an empty DB | Generated SQL assumes the `cms` schema exists | Hand-added `CREATE SCHEMA IF NOT EXISTS` to the baseline |
| `/programs/<draft>` returned HTTP 200 | Streaming pages answer 200 and then render not-found | Test asserts on rendered content |
| Browser login tests timed out on the 6th login | The real limiter (5 per window, keyed on a missing header) | Each browser context gets its own forwarded-for |
| E-mail link assertion | Quoted-printable wrapping; host is the build-time `NEXT_PUBLIC_SITE_URL` | Decode MIME; match path |
| `next build` failed | A Playwright-only matcher in a test file (the build type-checks `tests/`) | Used the project's assertion style |
| `getByRole('alert')` matched 2 elements | Next's route announcer is also `role=alert` | Selector narrowed |
| Smoke test "found" invented content | A stale server from an earlier run still held the port (`pkill` does not exist here) | Stopped by PID; check the port first |

No test was weakened or skipped to obtain a pass. The only `it.fails` is KN-22c, an open defect.

## What this does not show

Nothing here is evidence about staging or production, about the live Vercel deployment (unchanged), about behaviour with real S3/SES/Google credentials, about load, about accessibility, or about the contracted lab/PWA modules (none exist). The CI workflow has not run on GitHub.
