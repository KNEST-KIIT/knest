# KNEST Product & UX Remediation Log

**Date:** 27 October 2026
**Role:** Senior Product Manager, Security Engineer & Principal Frontend Engineer
**Orchestrator:** Codex
**Implementation Agent:** Antigravity
**Authoritative Acceptance Contract:** `docs/PRODUCTION-READINESS-EXECUTION.md`
**Governing Directives:** `AGENTS.md`, `src/styles/tokens.css`, `src/styles/fonts.ts`

---

## 1. Safety & Execution Directives

- **Local Execution Only:** Zero production credentials, no cloud mutations, no AWS/SES/DNS operations, no real email dispatch, and no real student data.
- **Preserve Existing State:** The fictional sandbox database at `C:\Users\anand\AppData\Local\KNEST\local-platform\postgres` was preserved. Idempotent schema migrations and synthetic seed reconciliation were run; no reset, wipe, production-data import, or real-student-data operation was performed.
- **Persistent Local Background Services:** Embedded PostgreSQL plus loopback SMTP/S3 stubs run on dynamically assigned local ports against fictional accounts. Browser sign-in creates local sessions; the acceptance harness does not create applications, save answers, submit decisions, or change CMS content. The exact Next.js 16.4.3 production preview runs on `http://127.0.0.1:3000` (`GET /api/health` -> 200).
- **Design Authority:** Oxblood (`#7a1f2b`), Deep Oxford Navy/Ink (`#0d1321`), Warm Parchment (`#f8f4e9`), Fraunces serif display, Instrument Sans text. Strict adherence to anti-slop guidelines: no generic SaaS templates, no artificial glassmorphism, no fake stats/badges, and purposeful reduced-motion compliance.
- **Evidence Taxonomy:** Strictly classify each item as `implemented`, `source-reviewed`, `regression-tested`, `browser-tested`, `hosted-provider-tested`, or `owner-accepted`. A green local candidate remains **not production ready** until hosted provider testing, operational recovery rehearsals, and owner sign-off are completed.
- **Version Control:** The candidate is maintained on branch `codex/production-v1`. Publishing that branch to GitHub is source control only and does not authorize deployment or production configuration changes.

---

## 2. Master Tracking & Evidence Matrix

| ID | Priority | Category | Summary & Resolution | Evidence Status | Verification Command & Evidence |
|---|---|---|---|---|---|
| **QA-001** | P3 | A11y / UI | Shared `Field` leaves dangling hint ID in `aria-describedby` when error is active. Resolved in `src/components/ui/field.tsx` by preserving both field hint and error IDs in `aria-describedby` when both are present, rendering both elements without dangling references. | `regression-tested` | `pnpm vitest run src/components/ui/field.test.ts` (verifies hint-only, error-only, both present, and neither present). |
| **QA-002** | P2 | A11y / UI | Radio groups lack arrow-key navigation and roving tabindex. Resolved in `src/app/(public)/journey-selector.tsx` & `src/components/ui/option-list.tsx` using WAI-ARIA roving tabindex (0/-1), ArrowUp/ArrowDown selection. | `browser-tested` | `npx tsx scripts/audit-browser-journeys.ts` (Suite 1: ArrowDown moves to next radio, ArrowUp returns to previous radio). |
| **QA-003** | P3 | UX / State | Homepage journey selector state lost on reload. Resolved in `src/app/(public)/journey-selector.tsx` using `useSyncExternalStore` with sessionStorage, bound checking, and in-memory fallback. | `browser-tested` | `npx tsx scripts/audit-browser-journeys.ts` (Suite 1 & 2) + lint free (`pnpm lint`). |
| **QA-004** | P1 | Security / Auth | Account ownership race & credential isolation: legacy verification POST without fresh password could promote attacker hash; failed attempt consumed token; catch-all leaked DB errors. Resolved in `src/server/auth/actions.ts`: mandatory fresh owner password for activation, row locking (`FOR UPDATE`), pre-session revocation, token consumed in tx only on success, safe error mapping. | `regression-tested` | `pnpm vitest run src/server/auth/actions.test.ts` passes. The database-backed `tests/integration/49-ownership-regression.test.ts` must be run with `vitest.integration.config.mts`; the default unit command does not include it. |
| **QA-005** | P2 | A11y / Forms | Onboarding field errors guessed by substring search; name error not wired to input. Resolved in `src/server/onboarding/actions.ts`, `src/app/api/onboarding/step/route.ts`, and `src/app/(member)/onboarding/onboarding-flow.tsx`: structured `fieldErrors` returned from Zod issues, mapped to `Field error={...}` and `Input ref={...}` with autofocus on invalid control. | `regression-tested` | `pnpm vitest run src/server/onboarding/validation.test.ts` (4/4 pass) + `pnpm vitest run src/server/onboarding/recommend.test.ts` (7/7 pass). |
| **QA-007** | P2 | A11y / Forms | Signup password validation does not mark or focus invalid password field. Resolved in `src/app/(auth)/signup/signup-form.tsx` by wiring `passwordRef` and error focus to invalid input. | `source-reviewed` | Source reviewed in `src/app/(auth)/signup/signup-form.tsx`, verified with `pnpm lint` and `pnpm typecheck`. |
| **QA-008** | P2 | UX / Content | Published file-only resources and dashboard links have no usable destination or dead-end href. External URLs allow unsafe protocols. Resolved in `src/lib/resource-url.ts`, `src/server/content/resources.ts`, and `src/app/(public)/resources/page.tsx`: strict URL parsing allowing only HTTP(S), falling back to internal `/resources/${slug}` on malformed/unsafe URLs. | `regression-tested` | `pnpm vitest run src/lib/resource-url.test.ts` (9/9 pass: rejects `javascript:`, `ftp:`, whitespace trimming, malformed URLs). |
| **QA-009** | P2 | UX / Journey | Expired open-status program advertises Apply and causes auth loop. Resolved in `src/app/(public)/programs/[slug]/apply-cta.tsx` and `src/app/(member)/apply/[program]/page.tsx` via unified effective availability check `closedReason()`. | `regression-tested` | `pnpm vitest run src/server/applications/availability.test.ts` (6/6 pass). |
| **QA-010** | P2 | UX / Journey | Student dashboard hides saved application drafts and accepted next step. Resolved in `src/app/(member)/dashboard/student-view.tsx`: drafts surfaced alongside submitted applications, and accepted next milestone card rendered prominently. | `browser-tested` | `npx tsx scripts/audit-browser-journeys.ts` (Suite 5: Accepted application next action card surfaced). |
| **QA-011** | P2 | A11y / Forms | Application form assigns all errors to current input. Resolved in `src/app/(member)/apply/[program]/application-form.tsx`: disentangled question validation errors (`fieldError`) from network/server drops (`formError`), accessible error alert with retry button. | `source-reviewed` | Source reviewed; the read-only browser suite verifies the form and 390px layout but deliberately does not save answers. A disposable-database error/retry browser test remains required before promotion. |
| **QA-012** | P2 | A11y / CMS | Event editor complex fields have missing accessible names / label targets. Resolved in `src/payload/components/SectionRowLabel.tsx` and `src/payload/globals/homepage.ts` with distinct, human-readable row labels. | `source-reviewed` | Source reviewed in `src/payload/components/SectionRowLabel.tsx`, verified with `pnpm typecheck`. |
| **QA-013** | P2 | Audit / CMS | Saving draft revision triggers false content-unpublish audit event. Resolved in `src/payload/audit-hooks.ts`: distinguishes draft revision updates from actual unpublish events. | `source-reviewed` | Source reviewed in `src/payload/audit-hooks.ts`, verified with `pnpm typecheck`. |
| **QA-014** | P2 | Data / CMS | Event editor permits publishing end date earlier than start date. Resolved in `src/payload/collections/events.ts`: cross-field validation `endsAt >= startsAt`. | `regression-tested` | `pnpm vitest run src/payload/collections/events.test.ts` (9/9 pass). |
| **QA-015** | P2 | Validation / CMS | Malformed external event registration URL produces dead-end 404 link. Resolved in `src/payload/collections/events.ts`: absolute HTTP/HTTPS URI regex validation. | `regression-tested` | `pnpm vitest run src/payload/collections/events.test.ts` (9/9 pass). |
| **QA-016** | P3 | Copy / UI | Single filtered result uses plural verb ("1 event match your filters"). Resolved in `src/lib/result-summary.ts`: correct singular verb agreement. | `source-reviewed` | Source reviewed in `src/lib/result-summary.ts`; add a focused unit assertion before calling this regression-tested. |
| **QA-017** | P2 | CMS / Journey | Homepage narrative section toggles do not control their individual sections. Resolved in `src/app/(public)/narrative.tsx` & `src/app/(public)/page.tsx`: Problem, Person, and KNEST narrative sections decoupled. | `browser-tested` | `npx tsx scripts/audit-browser-journeys.ts` (Suite 1: Problem, Person, and KNEST narrative sections render independently). |
| **QA-018** | P2 | CMS / Integrity | Homepage accepts duplicate fixed section keys, rendering duplicate heroes. Resolved in `src/payload/globals/homepage.ts`: enforces uniqueness across fixed section keys. | `source-reviewed` | Source reviewed in `src/payload/globals/homepage.ts`, verified with `pnpm typecheck`. |
| **QA-019** | P2 | Safeguards / CMS | Testimonials without explicit consent can be saved and are publicly readable. Resolved in `src/payload/access.ts` and `src/payload/collections/testimonials.ts`: restricted anonymous read access to `consentGiven === true`, corrected stale consent comment, default `defaultValue: false`. | `regression-tested` | `pnpm vitest run src/payload/access.test.ts` (20/20 pass). |
| **QA-020** | P3 | UX / CMS | CMS permission denial for authenticated staff shows generic login error. Resolved with dedicated access denial handler providing actionable feedback. | `source-reviewed` | Source reviewed in `src/payload/access.ts`, verified with `pnpm typecheck`. |
| **QA-021** | P2 | UX / CMS | Homepage curated testimonials and metrics saved but never rendered. Resolved in `src/app/(public)/ecosystem-section.tsx` & `src/app/(public)/page.tsx`: connected curated testimonials and metrics while preserving private source isolation. | `browser-tested` | `npx tsx scripts/audit-browser-journeys.ts` (Suite 1: Curated ecosystem section rendered). |
| **QA-022** | P2 | UX / Journey | Accepted founder dashboard omits startup linked to editorial profile. Resolved in `src/server/content/startups.ts` & `src/app/(member)/dashboard/founder-view.tsx`: surfaced latest active startup profile via `getStartupForUser(userId)`. | `browser-tested` | `npx tsx scripts/audit-browser-journeys.ts` (Suite 6: Founder dashboard surfaces venture content). |
| **QA-023** | P1 | Security / Harness | Browser test harness evaded the login limiter with random IP rotation and contained false-positive assertions. Resolved in `scripts/audit-browser-journeys.ts`: no always-true checks; stable synthetic persona IPs with cached sessions; failure diagnostics include final URL/heading/state. The mutating throttle probe is explicit opt-in and is not mislabeled as persona login evidence. | `source-reviewed` | Default command is read-only for application content. Run `AUDIT_MUTATING_SECURITY_PROBES=true` only for a dedicated local HTTP 429 probe, then record it separately from the persona matrix. |
| **QA-024** | P2 | Responsive / Layout | Responsive header intentionally uses drawer below 1280px (`xl`) with 44px menu target (`min-h-[44px] min-w-[44px] size-11`); stale 1024px fit assumptions updated in `tests/integration/36-header-fit.test.ts` with explicit 44px target bounds check. `/admin/applications` horizontal overflow at 390px; filter dropdown stale on Clear filters; compact staff navigation created undersized touch targets. Resolved in `src/components/layout/site-header.tsx`, `tests/integration/36-header-fit.test.ts`, `src/app/(staff)/admin/applications/page.tsx`, `layout.tsx`, `audit/page.tsx`, `members/page.tsx`. | `browser-tested` | Read-only local browser suite: Clear resets URL and form state; no overflow on three admin routes at 390px; every tested header action is at least 44px high. Integration test `36-header-fit.test.ts` enforces 44px target and drawer behavior across all widths. |
| **QA-025** | P2 | UI / Design Taste | Recommendation step and journey selector featured gratuitous `shadow-2xl`, gradients, hover scaling, and unreduced motion. Resolved in `journey-selector.tsx` & `onboarding-flow.tsx`: restrained parchment/oxblood visual language, `useReducedMotion()`, zero hover scaling, zero gratuitous shadows. | `browser-tested` | `npx tsx scripts/audit-browser-journeys.ts` (Suite 1, 2, 3) + verified clean styling tokens. |
| **QA-026** | P2 | Reconciliation / Integrity | (1) Header drawer breakpoint aligned to 1280px with 44px menu target; (2) Field preserves hint & error IDs in `aria-describedby` without dangling IDs; (3) `option-list` disables `whileHover`/`whileTap` scale under `prefers-reduced-motion`; (4) Auth forms replaced hardcoded orange gradients with restrained KNEST tokens; (5) Verification email copy aligned with choose-password activation step; (6) Corrected stale testimonial consent comment; (7) Uniquely prefixed admin filter control keys to eliminate duplicate empty key console warnings. | `regression-tested` | Unit tests (`field.test.ts`, `actions.test.ts`, `access.test.ts`), typecheck, and lint pass. |
| **QA-027** | P1 | Supply chain | Production audit found newly published critical/high advisories in direct and Payload-transitive dependencies. Direct Zod/Nodemailer ranges and workspace overrides for DOMPurify, Happy DOM, Undici, and fast-uri now require their first patched releases. | `regression-tested` | `pnpm audit --prod --audit-level=moderate`: exit 0; one documented moderate build/dev-only advisory ignored. Full unit, integration, build, and browser acceptance rerun after lockfile update. |
| **QA-028** | P2 | Responsive / Mentor | Mentor profile row retained intrinsic text/tag width and overflowed a 390px viewport by 95px. The profile now stacks on phones, shrinks safely, and wraps long expertise labels. | `browser-tested` | Final browser run: mentor dashboard `scroll=390`, `client=390`, `offenders=none`; overall 35/35 assertions pass. |

---

## 3. Local Browser Acceptance Results (Playwright on 127.0.0.1:3000)

Read-only multi-viewport acceptance executed with synthetic local personas at desktop (1280x800) and mobile (390x844). It creates local authentication sessions but does not create an application, save an answer, submit a decision or change CMS content. The security throttle probe is opt-in and excluded from this ordinary run.

```
========================================
STARTING LOCAL BROWSER ACCEPTANCE PASS (SYNTHETIC PERSONAS)
========================================

Suite 0: Security throttle probe skipped (set AUDIT_MUTATING_SECURITY_PROBES=true to run)

Suite 1: Public Homepage (Desktop 1280x800)
  ✓ [Homepage-Desktop] Page loads with correct title
  ✓ [Homepage-Desktop] Zero horizontal scroll overflow (1280px)
  ✓ [Homepage-Desktop] Journey selector displays 5 stages (found 5)
  ✓ [Homepage-Desktop] Journey selector ArrowDown moves to next radio (first=false, second=true)
  ✓ [Homepage-Desktop] Journey selector ArrowUp returns to previous radio (first=true)
  ✓ [Homepage-Desktop] Journey choice survives a reload in the same tab (second=true)
  ✓ [Homepage-Desktop] Journey selector exposes exactly one keyboard tab stop (tabStops=1)
  ✓ [Homepage-Desktop] Problem narrative section rendered independently
  ✓ [Homepage-Desktop] Person narrative section rendered independently
  ✓ [Homepage-Desktop] KNEST narrative section rendered independently
  ✓ [Homepage-Desktop] Curated ecosystem section rendered
  ✓ [Homepage-Desktop] All target=_blank links have rel="noopener noreferrer" (unsafe=0)

Suite 2: Public Homepage (Mobile 390x844)
  ✓ [Homepage-Mobile-390px] Zero horizontal scroll overflow (390px)
  ✓ [Homepage-Mobile-390px] Journey selector visible on 390px mobile

Suite 3: Onboarding Flow (390px Phone & Desktop)
  ✓ [Onboarding-Mobile-390px] Zero horizontal overflow on /onboarding at 390px
  ✓ [Onboarding-Mobile-390px] Onboarding view renders cleanly

Suite 4: Application Form State (390px, read-only)
  ✓ [Application-Mobile-390px] Zero horizontal overflow on /apply/ignite-ideation at 390px
  ✓ [Application] Preserved synthetic applicant has an existing application (no draft creation)
  ✓ [Application] Application form renders at /apply/ignite-ideation
  ✓ [Application] Application form exposes interactive controls without changing answers

Suite 5: Student Dashboard (390px & Desktop)
  ✓ [Student-Dashboard-390px] Zero horizontal overflow on student dashboard at 390px
  ✓ [Student-Dashboard] Accepted application next action card surfaced
  ✓ [Student-Dashboard] Notifications list clean of raw localhost/127.0.0.1 URLs
  ✓ [Student-Dashboard-Desktop] Zero horizontal overflow on desktop student dashboard

Suite 6: Founder Dashboard & Linked Startup
  ✓ [Founder-Dashboard-390px] Zero horizontal overflow on founder dashboard at 390px
  ✓ [Founder-Dashboard] Founder dashboard surfaces venture content

Suite 7: Mentor & Investor Dashboards (390px & Desktop)
  ✓ [Mentor-Dashboard-390px] Zero horizontal overflow on mentor dashboard at 390px
  ✓ [Investor-Dashboard-390px] Zero horizontal overflow on investor dashboard at 390px

Suite 8: Reviewer & Admin Console (390px & Desktop)
  ✓ [Reviewer-Console] Applications review queue loads filter form
  ✓ [Reviewer-Console] Filter dropdown updates URL search parameters
  ✓ [Reviewer-Console] Clear filters removes search param and resets form state
  ✓ [Admin-Mobile-390px] Zero horizontal overflow on /admin/applications at 390px
  ✓ [Admin-Mobile-390px] Zero horizontal overflow on /admin/audit at 390px
  ✓ [Admin-Mobile-390px] Zero horizontal overflow on /admin/members at 390px
  ✓ [Admin-Mobile-390px] Staff navigation interactive targets meet >= 44px touch height standard

========================================
AUDIT RUN SUMMARY
========================================
Total assertions: 35 | Passed: 35 | Failed: 0
ALL LOCAL BROWSER ACCEPTANCE ASSERTIONS PASSED!
```

---

## 4. Test Suite & Verification Results

1. **Static Analysis & Formatting:**
   - `git diff --check`: PASS (Clean, zero trailing whitespace or merge conflict markers).
   - `pnpm typecheck` (`tsc --noEmit`): PASS (Exit code 0, 0 errors).
   - `pnpm lint` (`eslint src tests`): PASS (Exit code 0, 0 lint warnings/errors).

2. **Automated Unit & Integration Test Suites:**
   - Unit result: **66 test files passed, 620 tests passed, 0 failures** (Duration: 81.93s).
   - Integration result: **36 files passed, 440 assertions passed, 1 documented expected failure** (441 total; duration: 1141.59s). This exact-candidate run includes zero-to-current migrations, production server/browser flows, authorization and ownership, uploads, concurrency, mail/S3/Turnstile stubs, labs, accessibility, and schema drift checks.
   - Key test suites verified:
     - `src/lib/resource-url.test.ts`: 9/9 tests passed (QA-008: HTTP/HTTPS validation, unsafe protocol rejection, whitespace trimming).
     - `src/server/onboarding/validation.test.ts`: 4/4 tests passed (QA-005: structured field error mappings).
     - `src/server/auth/actions.test.ts`: 4/4 tests passed (QA-004: activation validation and password constraints).
     - `src/app/(member)/dashboard/notifications-list.test.ts`: 3/3 tests passed.
     - `src/payload/collections/events.test.ts`: 9/9 tests passed (QA-014, QA-015).
     - `src/server/labs/http.test.ts` & `src/server/labs/qr-http.test.ts`: 7/7 tests passed (proves lab booking & QR attendance routes return 404 with no handler execution when flags are off).
     - `src/server/applications/availability.test.ts`: 6/6 tests passed (QA-009).
     - `src/payload/access.test.ts`: 20/20 tests passed (QA-019).

3. **Secret Scan:**
   - Command: `node scripts/scan-secrets.mjs`
   - Result: PASS for tracked files and changed/untracked candidate files; no credentials or local test data selected for commit.

4. **Build, Dependency, Runtime & Live Service Health:**
   - Next.js 16.4.3 production build: PASS; standalone assets copied. Build-time database fallback notices are expected because the production database is not contacted during compilation.
   - Production dependency audit: PASS at `--audit-level=moderate`; zero actionable production findings, with one explicitly documented build/dev-only advisory ignored in `pnpm-workspace.yaml`.
   - Background PostgreSQL: Active under `LOCALAPPDATA/KNEST/local-platform/postgres`; current migrations and synthetic seed reconciliation applied without reset or wipe.
   - Background Next.js standalone production preview: Active on `http://127.0.0.1:3000`.
   - `GET http://127.0.0.1:3000/api/health`: HTTP 200 `{"status":"ok"}`.

---

## 5. Production Readiness Verdict

Per `docs/PRODUCTION-READINESS-EXECUTION.md`:
> "A green local candidate remains **not production ready** until infrastructure, recovery, provider and owner gates are completed."

- **Local Candidate Status:** GREEN (`implemented`, `source-reviewed`, `regression-tested`, `browser-tested`).
- **Production Status:** **NOT APPROVED FOR PUBLIC PRODUCTION LAUNCH**.
- **Pending Non-Local Gates:**
  1. Infrastructure: CloudFront to origin HTTPS configuration, direct-origin restriction, least-privilege runtime DB identity in hosted RDS.
  2. Hosted Provider Verification: Real AWS SES sending identity verification, Cloudflare Turnstile production site keys, Google OAuth client credentials.
  3. Operational Drills: Database/S3 restore drills, credential rotation rehearsals, and alert notification verification.
  4. Final Owner Authority: Legal/privacy policy sign-off and explicit owner go/no-go.
