# Phase 1 gate report

Branch `delivery/p1-containment`, from `00181d4`, HEAD `a1ff0b9` plus the documentation commit that adds this file. Nothing has been pushed, deployed or merged. No cloud resource, shared database or credential was touched.

## 1. Changes and commits

| Commit | Task | Summary |
|---|---|---|
| `e95cef5` | C-03 | `lab-bookings` read restricted to `lab_admin`/`super_admin`, identity fields protected individually; `metrics.source` hidden; lab booking off unless `FEATURE_LAB_BOOKING=true` (page, link and both server actions); dev fake-success and mock spaces removed |
| `80fd8ad` | C-04, C-05 | dev auth bypass removed (fails closed); seed policy: default password only for a local DB outside production, no overwrite of existing accounts, demo/dummy seeds refuse production and non-local DBs; `patch_seed.mjs` deleted |
| `9b53040` | C-08 | `safeNext()` for login/signup redirects; valid dummy bcrypt hash; analytics endpoint allow-listed, bounded, size-capped and rate limited |
| `899a65f` | C-06 | Payload 3.88.0 -> 3.90.2, Next 16.3.3 -> 16.4.0, nodemailer 8 -> 10.0.16, sharp 0.35.5; transitive overrides in `pnpm-workspace.yaml` |
| `afb0887` | C-07 | media writes need the content area; SVG/XML uploads dropped; Staff `unlock` denied |
| `35bf0ca` | C-02 | fabricated records and unapproved claims removed; approved CONTENT_SPEC copy as the fallback; honest unavailable/empty states; content-honesty gate; `getSessionUser()` no longer swallows Next control-flow errors |
| `a1ff0b9` | C-01 | ESLint 9 flat config, `pnpm lint`, `pnpm check` |

Docs: `docs/audit/`, `docs/delivery/` (tracker, findings, donor map, contract traceability, this evidence).

## 2. Findings resolved

IMPLEMENTED (code done, closing evidence partly unavailable without a DB or environment): KN-01, KN-02, KN-03 (with two accepted advisories), KN-07, KN-08 (containment), KN-11 (endpoint), KN-17, KN-18 (removal), KN-20 (lint and tests; no CI), KN-22a, KN-22e, KN-22j, KN-27 (part), KN-28 (part), NF-01, NF-02, NF-03.
VERIFIED: KN-09, plus tasks C-01 and C-04.
Full table: `FINDINGS.md`.

## 3. Tests

| Check | Result |
|---|---|
| `pnpm run check` (lint, typecheck, vitest) | **exit 0**: 0 lint errors (28 warnings), `tsc` clean, **13 files / 173 tests passed, 0 failed** (`phase1-check.md`). Baseline was 3 files / 20 tests. |
| Mutation check on the KN-02 test | Restoring `read: () => true` fails 2 tests; restored afterwards |
| Content-honesty gate | Failed on real offenders (unsupported-claim and substitute-record matches) before they were fixed; passes now |
| `pnpm build` (Turbopack, Next 16.4.0) | exit 0 |
| Production smoke, fresh `next start`, no DB | `/` renders the approved hero and "Programs could not be loaded"; no fabricated string on any page; `/admin` 404; forged `application_accepted` event -> 204, nothing written (`phase1-smoke.md`) |
| Seed scripts under unsafe settings | all four refuse with exit 1 (`seed-refusals.md`) |
| `pnpm audit --prod` | 4C/21H/23M/7L -> **0C/1H/1M/0L** (`audit-after.md`) |
| Secrets scan of added lines | clean; only `.env.example` is tracked |

**Not run, because no database or environment exists:** any DB-backed test, REST-level authorization test, migration test, E2E, load test, axe/Lighthouse. Those are Phase 2+ work.

Failures encountered and resolved during the work: `next build` (Turbopack) fails on Next 16.3.8 with this Payload line (font module resolution) while 16.3.3 and 16.4.0 build, so 16.4.0 was chosen; a first build failed because `/blog` was statically prerendered and the content layer now correctly throws without a DB (made dynamic); a stale server on port 3100 produced a false "fabricated content" smoke result until it was stopped and the test repeated.

## 4. Remaining vulnerabilities

**In the repository**
- `braces` (high, no patch exists): ReDoS through deeply nested glob patterns, reached only through `sass -> chokidar` file watching. Accepted.
- `esbuild` (moderate): dev-server request exposure, via drizzle-kit's legacy loader. Accepted; do not expose a dev server.
- Open and unchanged (later phases): `isActive` not enforced on sessions; submit/review/capacity races; program delete/unpublish returns 500 on review; onboarding drops the return path; Google button always shown; spoofable rate-limit key and no per-account login bucket; unthrottled verify/reset-confirm; signup enumeration (400 vs 201); plaintext verification/reset tokens; no Origin check; `userId`-trusting helpers in `'use server'` files; CSP `unsafe-inline`; no Payload migrations (so a production database cannot be created reproducibly); email/S3 not production-wired; no monitoring, CI, `/privacy` or `/terms`.
- `lab_admin` still has no migration, so only `super_admin` can write Infrastructure (NF-04).

**On the live deployment (`knest-kiit.vercel.app`): not changed by this work**
- It still serves the fabricated `/blog` content, the old hero copy and other unapproved claims, and 404s `/privacy` and `/terms`. Fixing that requires a redeploy, which was not authorised.
- KN-02 is latent there (Payload fails to initialise, HTTP 500). If a working database with a `cms` schema is attached to that deployment before it is redeployed, booker emails become readable.

## 5. Regressions identified

1. **Next 16.3.3 -> 16.4.0 is a minor upgrade, and Payload 3.88 -> 3.90, nodemailer 8 -> 10 (major) were never exercised against a database, SMTP server or the Payload admin UI.** Build, types and unit tests pass. Runtime behaviour is unproven.
2. Several public pages (`/`, `/about`, `/ecosystem`) are now rendered per request instead of being prerendered as signed-out. That is the correct behaviour (it was a latent bug), but it costs some response time. Measure in P7.
3. The homepage "problem / person / what KNEST is" section is deliberately plain. It will look different from the old dense block until the P4 redesign.
4. The founder and student dashboards lose the "Founder Playbooks" card. Founder: the applications card now spans the full row.
5. With the CMS or database down, list pages now show the error boundary instead of invented content. This is intended; there is still no monitoring, so nobody is notified.
6. `getSessionUser()` uses `unstable_rethrow`, which Next marks as an unstable API.
7. The interim lab-booking code is still in the tree behind a flag, with two lint waivers, until it is replaced.
8. 28 lint warnings remain (unused variables, `<img>`, relative location assigns). Not suppressed; tracked for P4.

## 6. Phase 1 acceptance verdict

Exit criteria from the blueprint (Part H), judged only on evidence:

| Criterion | Verdict | Evidence |
|---|---|---|
| No `FALLBACK_` records | **Met** | gate test, grep |
| Anonymous `/api/lab-bookings` denied | **Met at the access-rule level; not shown through a live REST call** | 24 access-policy tests, mutation-checked. A REST-level test needs Payload and a DB. |
| `pnpm audit` 0 critical / 0 high on runtime paths | **Met with one documented exception** | 0 critical; 1 high (`braces`, no patch exists, build-time path) |
| Seeds guarded | **Met** | policy tests and four executed refusals |
| Dev bypasses gone | **Met** | guards tests across three environments |
| Lint runs, tests green | **Met** | `phase1-check.md` |

**Verdict: PASSED for the repository, with conditions.**
- Passed means the code on this branch contains and tests the Phase 1 remediation.
- It does **not** mean the live site is safer: the live deployment is unchanged until the owner authorises a redeploy.
- It does not mean KN-02 is closed in the strict sense (REST-level evidence needs a database).
- Only C-01 and C-04 are VERIFIED. The rest are IMPLEMENTED.

## 7. Decisions and actions for the owner

1. **Live deployment.** Choose: (a) leave it as is, (b) put Vercel deployment protection on it or take it offline, or (c) approve a redeploy of this branch. Option (c) needs a merge target decision and, for the lab-bookings lock, a working database to test against. Until then, note that the live site shows invented articles and old copy under KIIT's name.
2. **Confirm the interim hero** reverts to the CONTENT_SPEC copy until HD-04 names an approver (done in code).
3. **HD-21 / HD-22 / HD-19** (invoice status, contract variation, KIIT-owned AWS account) gate everything in Phase 2.
4. Confirm that a **contact named in the official brochure** (shown on `/about`) may stay public; it was kept because the brochure publishes it.

## 8. Next recommended batch

Not started; needs separate authorisation (S-1 needs cloud access).

1. **P1b, repository-only, can start now:** CI workflow file and `pnpm audit` gate (F-10, no cloud needed); root `not-found` and `global-error` (NF-08); `lab_admin` Drizzle migration plus `roles.test.ts` update (NF-04, NF-11); README refresh (F-12 part).
2. **P3A items that need no infrastructure:** R-01 (onboarding return path), R-02 (Google guard, `isActive`), R-06 (explicit application start, re-validation at submit), R-08/R-09 (auth hardening, Origin check), R-12/R-13 (email links, deadlines). Each is testable with a local Postgres (Docker is not installed on this machine, so the first step is to provide one).
3. **S-1 hosting spike:** requires a sandbox AWS account and your explicit authorisation, plus HD-19.
