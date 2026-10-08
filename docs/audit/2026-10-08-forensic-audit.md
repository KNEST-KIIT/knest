# ENTERPRISE PRODUCT & ENGINEERING FORENSIC AUDIT
## Current State -> Target State -> Delivery Readiness

**Product:** KNEST (KIIT Nurturing Entrepreneurship & Student Talent) digital platform
**Repository:** `knest` (local checkout), branch `claude/knest-ecosystem-platform-g9erjs`, HEAD `00181d4`
**Audit date:** 2026-10-08
**Mode:** inspection only. No application code, configuration, data or infrastructure was changed. Only one file was added: this audit document, under `docs/audit/`.

Evidence labels: **VERIFIED** (direct code or runtime evidence) · **INFERRED** (strong inference, not directly observed) · **UNVERIFIED** (insufficient evidence) · **CONTRADICTED** (evidence conflicts with a claim) · **N/A**.

"VERIFIED(code)" means confirmed by reading source at the cited line. "VERIFIED(runtime)" means observed in a running build during this audit. Nothing that depends on a live database was runtime-verified (see section 02).

---

## 01. EXECUTIVE VERDICT

**What the product is.** KNEST is KIIT University's digital front door and operating layer for student entrepreneurship. It has three surfaces over one data model:
- a public site (discover, self-locate, apply);
- a member area (onboard, track applications, register for events);
- a staff console (Payload CMS plus a custom application-review UI).

The intended conversion event is a **submitted program application** (`docs/PRODUCT_ARCHITECTURE.md` section 2).

**Intended business outcome.** Turn KIIT students into founders and route them into KNEST programs. Let staff run programs and publish content without developers. Demonstrate outcomes honestly: the KIIT prospectus targets 150-200 student startups over five years.

**What has genuinely been achieved.** The August 2026 build (phases 0-12) produced a well-specified, well-reasoned codebase:
- revocable database sessions;
- a single guard module;
- a clean `cms`/`app` schema split;
- a tested application state machine;
- transactional status changes with an audit log;
- magic-byte file verification;
- a Postgres-backed rate limiter;
- consistent loading and error boundaries;
- unusually candid retrospectives.

Typecheck passes, the 20 unit tests pass, and a production build succeeds (all VERIFIED(runtime)).

**Current delivery readiness: NOT READY FOR DELIVERY.** The September 2026 changes moved the product away from its own approved contract. On top of that, the path to production has never been exercised end to end.

**The five most serious issues:**
1. **Fabricated content on the public site (KN-01, P0).** Invented startups, mentors, programs, events and bylined articles appear whenever the CMS is empty, and an empty CMS is the expected launch state. Some invented mentors are attributed to real companies. This directly violates the product's founding principle ("Never invented", PRODUCT_ARCHITECTURE section 6). Observed at runtime on `/blog`.
2. **Unauthenticated exposure of booker emails (KN-02, P0).** The newly added lab-booking collection is world-readable through the Payload REST API, which returns booker emails and user IDs.
3. **Vulnerable framework versions (KN-03, P0).** Payload 3.88.0 and Next 16.3.3 match published critical and high advisories (`pnpm audit`: 4 critical, 21 high, 23 moderate, 7 low).
4. **No reproducible deployment (KN-04, P0).** There are no Payload migrations, so a production database never gets the `cms` schema. A new role (`lab_admin`) was added without a migration. Migrations are a manual step.
5. **Core-loop dependencies not production-safe (KN-05, P1; P0 if confirmed).** The core loop's dependencies are not wired for the actual hosting target:
   - Without SMTP, verification and reset emails are written to logs, including reset tokens. Users cannot verify, and unverified users cannot submit applications.
   - The S3 client is never given credentials.
   - CMS media writes to local disk on what is evidently a Vercel deployment.

**Biggest architectural concern:** the deployment target is contradictory. The README and architecture docs describe AWS ECS, RDS, S3 and SES. The code and configuration show Vercel (`next.config.ts:35`, `.vercel/project.json`, `VERCEL_URL` usage), and `.env` also holds unused Supabase keys. Storage, email, connection pooling, migrations and rate-limit IP keys all depend on which platform is real.

**Biggest product concern:** scope and claims changed in September without a recorded decision:
- lab booking (explicitly "deliberately absent" in the spec);
- a blog with fabricated articles;
- a rewritten homepage hero and unapproved institutional claims ("15,000+ sq. ft.", "The capital is waiting", "Top Tier Global Ranking");
- fake course progress on dashboards;
- removal of search from navigation.

**Most important next step:** Stage 0 (section 18):
- Settle the hosting target.
- Remove all fabricated content.
- Lock down or pull lab booking.
- Upgrade Payload and Next.
- Then deploy once to a real staging environment and walk the golden path (signup, verify email, onboard, apply, upload, submit, staff review, notification) on a production build.

---

## 02. EVIDENCE AND INSPECTION COVERAGE

### Inspected
| Area | Method |
|---|---|
| Full source tree `src/**` (about 200 files) | Read by four parallel review passes (security, data/backend, frontend/UX, analytics/QA/ops). Key claims re-checked by the lead auditor. |
| Product docs | `README.md`, `DESIGN.md`, `docs/PRODUCT_ARCHITECTURE.md`, `USER_JOURNEYS.md`, `CONTENT_SPEC.md`, `UX_WIREFRAMES.md`, three phase plans and three retrospectives |
| Source brief | `KNEST.pdf` (tracked, 10 pages) and `KNEST (1).pdf` (untracked, newer, 11 pages). Text extraction only. |
| Git history | 47 commits. 2026-08-29 to 08-30: phase work authored by an AI assistant. 2026-08-31 to 09-17: human-authored commits. |
| Database | Drizzle schema + migrations 0000-0005 + journal; Payload collection configs |
| Configuration | `next.config.ts`, `package.json`, `drizzle.config.ts`, `docker-compose.yml`, `.gitignore`, `.vercel/project.json`, `.env`/`.env.local` (**variable names only**; values not printed) |

### Commands executed (all non-destructive)
| Command | Result |
|---|---|
| `pnpm run typecheck` | **Pass** (0 errors) |
| `pnpm test` (vitest) | **3 files, 20 tests, all pass** (2.2 s) |
| `npx eslint src` | **Crash**: `TypeError: Converting circular structure to JSON` from `.eslintrc.json` (eslint 8.57 + eslint-config-next 16.3.5, which needs eslint 9). Lint is non-functional. |
| `pnpm audit --prod` | **55 advisories: 4 critical, 21 high, 23 moderate, 7 low** |
| `pnpm build` | **Success** (exit 0, 36 routes). It logged Postgres connection errors (no DB available) and an analytics insert attempted during prerender. pnpm warned that `pnpm.overrides` in `package.json` is ignored. |
| `pnpm start -p 3100` + built-in browser | Public pages exercised **without a database**: link crawl, mobile 375 px overflow check, headings check, server logs |

The build regenerated the git-ignored `.next/` directory. A temporary git-ignored `.claude/launch.json` was created to start the server and deleted afterwards. The git tree is otherwise unchanged.

### What could not be inspected
- **No database available.** Postgres was not reachable on `localhost:5432` and Docker is not installed. Every DB-backed journey is therefore verified from source only and is **not runtime-verified**: signup, login, onboarding, apply, upload, submit, review, events, notifications, lab booking and analytics writes.
- **No production or staging deployment access.** I had no Vercel dashboard, production URL, env settings, logs or DB, so production state is UNVERIFIED throughout.
- **Not done:** load or performance testing, screen-reader testing, cross-browser testing, Lighthouse runs.
- **Not supplied:** stakeholder feedback, issue tracker, design files, analytics data (section 16 is PENDING INPUT).
- **Payload admin UI** was not exercised at runtime (it needs a DB).

### Confidence
- **High** for code-level findings (multiple independent passes with line-level evidence).
- **Medium** for production-impact findings (the platform is inferred).
- **Low** for any claim about real runtime behaviour of DB-backed flows.

---

## 03. PRODUCT VISION AND SCOPE RECONSTRUCTION

**Original goal (source brief, `KNEST.pdf`).** A university-wide innovation and entrepreneurship ecosystem built on a "triple helix" of the university, its schools and corporate partners. Its objectives:
- ideation and venture creation;
- structured idea validation;
- mentors, markets, funding and policy access;
- an alumni-led ecosystem.

It lists physical infrastructure (10,000-15,000 sq. ft. co-working, maker labs, studios, cabins) and a "Startup Management System". The expected outcomes are targets: 150-200 student startups in five years and 25-30 scalable ventures a year.

The newer, untracked `KNEST (1).pdf` adds an alumni pillar, the School of Innovation & Entrepreneurial Leadership's MBA-IEV program, and a KIIT TBI pipeline. Whether the site should reflect this version is open (HD-15).

**Current goal (`PRODUCT_ARCHITECTURE.md`).** The core loop is: Discover -> Self-locate -> Onboard -> Find program -> **Apply** -> Track. Participation is deferred to the next slice.

**Users and personas (`USER_JOURNEYS.md`):**
1. Exploring student
2. Aspiring founder
3. Accepted founder
4. Mentor
5. Investor
6. Partner
7. Staff (program manager, reviewer, content admin, startup/mentor manager, super admin)

**Approved scope (this slice):**
- public pages `/`, `/programs[/slug]`, `/startups[/slug]`, `/mentors`, `/ecosystem`, `/invest`, `/events[/slug]`, `/resources[/slug]`, `/about`, `/search`;
- member pages `/onboarding`, `/dashboard`, `/dashboard/applications`, `/apply/[program]`, `/profile`;
- the Payload staff console and custom application review;
- auth (email + password, optional Google);
- rule-based recommender, event registration, in-app and email notifications, internal funnel analytics.

**Deferred or deliberately absent (section 7 of the architecture doc):**
- investor dashboard;
- mentor matching and booking;
- full founder workspace;
- messaging and feed;
- **infrastructure booking** ("Needs an operational booking policy that does not exist yet. Showcase only.");
- co-founder discovery;
- page builder (permanent);
- AI recommender.

**Requirement conflicts (CONTRADICTED):**
| Conflict | Spec says | Implementation |
|---|---|---|
| Content honesty | "Never invented: startups, mentors... testimonials. Every counter reads a real table." | Fabricated fallbacks in 5 content modules; `seed-demo.ts`; fake dashboard progress (KN-01, KN-17) |
| Infrastructure booking | Deliberately absent | Lab booking added 2026-09-17 (KN-08) |
| Co-founder discovery | Deliberately absent | Homepage copy promises "technical co-founder matchmaking events" (`the-journey.tsx:29`) |
| Hosting | ECS Fargate, RDS, S3, SES | Vercel indicators; Supabase keys in `.env` (KN-06) |
| `/search` | Public route | Exists but nothing links to it after `d32900b` |
| `/profile` | Member route | 404 (VERIFIED(runtime)) |
| Blog | Not in `CONTENT_SPEC` nav | Added with fabricated articles; cards link to `/resources` |
| Homepage hero | "WHAT IF YOU ACTUALLY BUILT IT?" (`CONTENT_SPEC` 1.1) | "THE MOST DANGEROUS THING YOU CAN DO IS GRADUATE WITH JUST A DEGREE." The page title still uses the spec line. |
| Lint | README lists the commands | The `lint` script was removed; ESLint crashes |

**Definition of completion (reconstructed).** The slice is complete when, on the real production platform:
- a stranger can discover a **real** program;
- they can sign up, verify their email, onboard and return to their original intent;
- they can apply (including file uploads) and submit, and track the status;
- staff can review and transition applications, with audit and notifications;
- staff can publish and unpublish content without breaking applications;
- every public number and record is real or explicitly framed as a target;
- the release is reproducible (migrations, environment), observable (errors visible) and reversible.

---

## 04. COMPLETE APPLICATION INVENTORY

### Routes (from the production build output, VERIFIED(runtime))
| Surface | Routes | Data source | Notes |
|---|---|---|---|
| Public | `/` | CMS homepage global + hardcoded sections + programs | 3 `h1` elements (runtime); fallback copy if CMS fails |
| | `/programs`, `/programs/[slug]` | CMS, then **fabricated fallback** | |
| | `/startups`, `/startups/[slug]` | CMS, then **fabricated fallback** | |
| | `/mentors`, `/mentors/[slug]` | CMS, then **fabricated fallback** | |
| | `/events`, `/events/[slug]` | CMS, then **fabricated fallback** (upcoming) | |
| | `/resources`, `/resources/[slug]` | CMS, honest empty state | |
| | `/blog` | CMS articles, then **fabricated fallback** | No loading, error or empty state; cards link to `/resources` |
| | `/about`, `/ecosystem`, `/invest` | Mostly hardcoded; `/invest` uses fallbacks | `#contact` and `#partner` anchors missing |
| | `/search` | CMS (4 parallel finds) | No inbound link |
| Auth | `/login`, `/signup`, `/reset`, `/reset/confirm`, `/verify`, `/verify/confirm` | Auth API | Google button always rendered |
| Member | `/onboarding`, `/dashboard`, `/dashboard/applications`, `/dashboard/events`, `/dashboard/lab-booking`, `/apply/[program]` | DB + CMS | `/dashboard/events` has no inbound link; `/profile` missing |
| Staff | `/admin/[[...segments]]` (Payload), `/admin/applications[/id]`, `/admin/analytics` | DB + CMS | Non-staff get 404 (runtime: 404 with no session) |
| API | 20 route handlers under `/api/**` plus the Payload REST catch-all `/api/[...slug]` | | See section 08 matrix |
| Missing | `/privacy`, `/terms` (linked in footer), `/profile`, `sitemap.xml`, `robots.txt`, `not-found.tsx`, `global-error.tsx` | | 404 (runtime) |

### Backend modules (`src/server/*`)
- `auth`: config, session, guards, roles, tokens, validation, actions
- `applications`: actions, transitions, review, validation, program-questions
- `onboarding`: actions, recommend, validation
- `events`: actions
- `notifications`: actions, send, templates
- `email`: send, templates (nodemailer)
- `storage`: S3 or local disk
- `security`: rate-limit, file-verify
- `analytics`: track, funnel
- `content`: 11 Payload read modules plus search
- `actions/lab-booking.ts`

### Data
**`app` schema (Drizzle):**
- `users`, `accounts`, `sessions`, `verification_tokens`
- `onboarding` fields on users
- `applications`, `application_answers`, `application_documents`
- `notifications`, `audit_logs`, `event_registrations`, `analytics_events`, `rate_limits`

Migrations `0000`-`0005`. Cross-schema references (`program_id`, `event_id`) have no foreign keys.

**`cms` schema (Payload):** programs, cohorts, startups, founders, mentors, partners, events, resources, articles, infrastructure, **lab-bookings**, testimonials, faqs, metrics, media, staff (a read-only mirror), plus the homepage global. **No migrations committed.**

### Integrations
| Integration | Status |
|---|---|
| Auth.js v5 beta 32 (credentials via a custom DB-session mint; Google OAuth optional) | Active |
| nodemailer SMTP | Logs to console when unset |
| AWS S3 SDK (documents) | Credentials not passed |
| Payload local-disk media | |
| Analytics | No third-party analytics, error tracking or monitoring |
| Supabase / Vercel OIDC | Variables present in `.env`, `.env.local`; Supabase is unused by code |

### Infrastructure in repo
- `docker-compose.yml` (local Postgres)
- `.vercel/project.json` (linked project)
- No CI, no IaC, no health endpoint, no backup or rollback documentation

### Analytics and dashboards
- `app.analytics_events` with 13 event names (server-side `track()`)
- One client endpoint: `/api/analytics/track`
- `/admin/analytics`: all-time event counts plus an "Activated Builders" North Star
- Payload `BeforeDashboard`: 3 unfiltered counts
- The Metrics collection is unused

### Non-runtime material in repo
These have no imports from `src` (VERIFIED(code)):
- about 285 design-kit files, about 40k lines: `design-systems/` (138 DESIGN.md), `frameworks/`, `taste/`, `tokens/`, `workflows/`, `components/*.md`, `accessibility/*.md`, `scripts/*.py|*.mjs`, `.agents/`, `.claude/skills`;
- `KNEST.pdf` (16.6 MB, tracked);
- `patch_seed.mjs`.

---

## 05. REQUIREMENTS TRACEABILITY MATRIX

Status vocabulary: Complete and verified · Implemented but not verified · Partially implemented · Implemented incorrectly · Not implemented · Conflicting · Out of approved scope · Unknown.

| ID | Source | Objective | Intended behaviour | Implementation evidence | Verification | Status | Gap | Priority |
|---|---|---|---|---|---|---|---|---|
| R-01 | ARCH section 3 | Discover | Public program list/detail from CMS | `server/content/programs.ts`, `(public)/programs/*` | Build OK; DB-less runtime shows error boundary | Implemented incorrectly | Fabricated fallback on empty or error (KN-01) | P0 |
| R-02 | ARCH section 6 | Honesty | Empty ecosystem renders 0 / EmptyState | `EmptyState` exists; fallbacks bypass it | `/blog` runtime shows fabricated posts | Implemented incorrectly | KN-01, KN-17 | P0 |
| R-03 | JOURNEYS 1 | Self-locate | Journey selector -> path | `journey-selector.tsx` | Runtime renders | Implemented but not verified | Radio a11y (KN-19) | P2 |
| R-04 | ARCH section 2 | Onboard | 6 steps -> recommended path with reason | `onboarding/*`, `recommend.ts` (+7 tests) | Unit tests pass | Partially implemented | Completion result ignored; CTA always goes to `/dashboard`; `next` lost (KN-14) | P1 |
| R-05 | JOURNEYS 2 | Intent survives signup | Return to application after signup and onboarding | `signup-form` passes `next`; onboarding drops it | Code | Implemented incorrectly | KN-14 | P1 |
| R-06 | ARCH section 5 | Auth | Email+password, verify, reset; DB sessions | `server/auth/*` | Code; retro says live-verified in Aug | Implemented but not verified | Enumeration, isActive, redirect (KN-10, KN-22) | P1 |
| R-07 | ARCH section 5 | Optional Google SSO | Shown only when configured | Guard removed in `4cc124f` | Code | Implemented incorrectly | KN-15 | P1 |
| R-08 | ARCH section 2 | Apply | Generic question set, draft, answers, uploads, submit | `server/applications/*` | Code + 7 transition tests | Implemented but not verified | Prod storage/email (KN-05); races (KN-13); CMS delete 500 (KN-12) | P1 |
| R-09 | ARCH section 2 | Track | Status visible, never ambiguous | `/dashboard/applications`, status badge | Code | Implemented but not verified | No | P2 |
| R-10 | JOURNEYS 7b | Staff review | Transition with audit and notification | `review.ts` transactional | Code | Implemented but not verified | Lost-update race (KN-13) | P2 |
| R-11 | JOURNEYS 7a/7c | Staff operate content | Payload console, role-gated | Payload config + `access.ts` | Code; vulnerable Payload version | Implemented but not verified | KN-03 | P0 |
| R-12 | ARCH section 5 | /admin 404 to non-staff | `requireStaff -> notFound()` | `(payload)/layout.tsx:19` | Runtime 404 without session (VERIFIED) | Complete and verified (unauthenticated case only) | Staff case unverified | — |
| R-13 | ARCH section 3 | Member `/profile` | Profile page | None | Runtime 404 | Not implemented | Decision HD-13 | P2 |
| R-14 | ARCH section 3 | `/search` | Public search | Route exists | No inbound link | Partially implemented | HD-09 | P3 |
| R-15 | 7-9 plan | Events + internal registration | Register/unregister with capacity | `events/actions.ts` | Code | Implemented but not verified | Capacity race; past events not blocked | P2 |
| R-16 | ARCH section 4 | Notifications in-app + email | Channel field; email on status change | `notifications/*` | Code | Implemented but not verified | Relative links in email; inline SMTP | P3 |
| R-17 | 10-12 plan | Funnel analytics | Events + admin report | `track.ts`, `funnel.ts` | Code; prerender insert attempt seen in build | Implemented incorrectly | Forgeable, non-stitched, all-time only (KN-11) | P1 |
| R-18 | 10-12 plan | Security hardening | Rate limits, file sniffing, CSP | Implemented | Retro says live-verified | Partially implemented | XFF key, unthrottled endpoints, `unsafe-inline` (KN-22) | P2 |
| R-19 | README | Reproducible deploy | Migrations + standalone | Drizzle only; no Payload migrations | Build VERIFIED | Partially implemented | KN-04 | P0 |
| R-20 | ARCH section 8 | Hosting on AWS | ECS/RDS/S3/SES | Vercel indicators | Config | Conflicting | KN-06, HD-01 | P0 |
| R-21 | ARCH section 7 | No infrastructure booking | Showcase only | Lab booking shipped | Code | Out of approved scope | KN-08, HD-03 | P0 (PII) / P1 |
| R-22 | — (undocumented) | Blog | — | `/blog` | Runtime: fabricated | Out of approved scope | HD-08 | P1 |
| R-23 | Footer | Legal pages | `/privacy`, `/terms` | None | Runtime 404 | Not implemented | HD-06 | P1 |
| R-24 | Retro 10-12 section 9.1 | Staging golden-path verification | Real deploy, real HTTPS | None recorded | — | Not implemented | KN-33 | P0 |
| R-25 | Retros (x3) | Unit tests for pure functions; CI | — | 20 tests; no CI | Runtime | Not implemented | KN-20 | P1 |

---

## 06. FUNCTIONAL AUDIT

### Verified working (runtime, DB-less production build)
- **Static/public shell:** header, footer, homepage hero, journey selector and trajectory carousel render. There is no horizontal overflow at 375 px. Every `img` has `alt`.
- **Fail-closed admin:** `/admin` and `/admin/analytics` return 404 to an anonymous visitor. `/dashboard`, `/onboarding` and `/dashboard/lab-booking` redirect when there is no session.
- **Graceful Payload REST failure:** with the DB down, `/api/lab-bookings` and `/api/programs` return a JSON 500. No stack trace is exposed.

### Major journeys: source-level verdict (runtime UNVERIFIED for all)

| Journey | Entry -> actions -> system response -> data change -> success | Failure path | Verdict |
|---|---|---|---|
| J1 Explore -> sign up | `/` -> journey selector -> `/signup` -> POST `/api/auth/password/signup` -> `app.users` row + verification email -> `/onboarding` | No SMTP: email logged, not sent (KN-05) | Works in code; email delivery unverified |
| J2 Idea -> application | `/programs/[slug]` -> Apply -> (signup) -> onboarding -> **lands on `/dashboard`, not the application** (KN-14) -> `/apply/[program]` (**viewing creates a draft**) -> answers autosave -> upload -> submit (requires verified email) -> `applications.status=submitted` + notification + email | Fallback program: 404 on detail, "doesn't exist" on apply; deleted or unpublished program: 500 (KN-12); prod upload fails without S3 credentials (KN-05); double-click: two submissions recorded (KN-13) | Partially working |
| J3 Accepted founder | Staff transitions -> notification + email -> dashboard shows status | Concurrent reviewers can produce an illegal net transition (KN-13); email links are relative paths | Works in code |
| J4 Mentor | `/mentors` -> "Become a mentor" -> `/mentors#become-a-mentor` / `/about#contact` | `#contact` anchor missing; no contact mechanism | **Missing workflow** (contact pathway) |
| J5 Investor | `/invest` -> fabricated startups and articles -> "Want to talk" -> `/about#contact` | Same as J4 | Misleading + incomplete |
| J6 Partner | `/about#partner` | Anchor missing | Missing |
| J7 Staff | `/login` -> `/admin` (Payload) and `/admin/applications` | Payload advisories; Media uploads to local disk on Vercel | Implemented; unverified |
| J8 Lab booking (new, unspecified) | `/dashboard/lab-booking` (founder only, page-level) -> pick space, date, slot -> server action -> `cms.lab_bookings` pending | No server-side role check or validation; dev returns fake success on error; no "my bookings"; no approval notification; booker PII public | **Implemented incorrectly**, out of scope |

### Broken or misleading items with reproduction steps
- **KN-01 fabricated blog.** Reproduce: `pnpm build && pnpm start` with no DB (or an empty CMS), then open `/blog`.
  - Expected: an empty state.
  - Actual: bylined "founder stories" such as "From Hostel Dorm to First 10,000 Users" and "Securing Your First Rs 10 Lakh Prototype Grant", attributed to invented people and a "KNEST Investment Desk" (VERIFIED(runtime)).
- **Footer legal links.** Footer -> Privacy Policy / Terms of Service -> **404** (VERIFIED(runtime)).
- **Error page that misstates what happened.** Open `/programs` while the DB is down. It shows "Something went wrong on our end. Not your fault. We've been told about it." No error-reporting service exists (KN-21), so nobody has been told. The HTTP status is 200 (VERIFIED(runtime)).
- **Fallback program dead end.** The homepage links to `/programs/ignite-ideation`, which is a fallback slug. A visitor clicking it gets a 404 or error. Fallback filters ignore status, so "closed" filters show open programs (VERIFIED(code)).
- **Google button.** On any environment without `AUTH_GOOGLE_*`, "Continue with Google" leads to an Auth.js error page (VERIFIED(code): `googleEnabled` is received but never used, `login-form.tsx:8`).
- **Onboarding completion loop.** If `postStep('complete')` fails, the user is pushed to `/dashboard`, bounced back to `/onboarding` and restarts at step 1 with no error (VERIFIED(code): `onboarding-flow.tsx:378`).
- **Auth forms.** A network failure leaves "Authenticating..." on screen forever (no try/catch). The reset form shows "Check your email" even on a 429 (VERIFIED(code)).
- **Fake progress.** The student and founder dashboards show hardcoded "Idea Validation 101: 100% completed" to brand-new users (VERIFIED(code): `student-view.tsx:31-35`, `founder-view.tsx:104-109`).

---

## 07. ARCHITECTURE AND CODE REVIEW

### Current-state architecture
```mermaid
flowchart LR
  subgraph Browser
    P[Public pages RSC]:::pub
    M[Member pages RSC + client forms]:::mem
    A[Staff: Payload admin + /admin/applications]:::stf
  end
  subgraph "Next.js 16 app (single deployable; Vercel inferred, AWS documented)"
    G[server/auth/guards.ts<br/>+ Payload authJsStrategy]
    RH[/api/** route handlers + server actions/]
    C[server/content/*<br/>Payload Local API<br/>+ FALLBACK_* fabricated data]
    AP[server/applications/*<br/>state machine + tx + audit]
    T[server/analytics/track.ts]
    RL[security/rate-limit.ts<br/>Postgres token bucket]
    EM[email/send.ts<br/>nodemailer or console.log]
    ST[storage/index.ts<br/>S3 or local disk]
    PL[Payload CMS 3.88<br/>REST /api/[...slug]]
  end
  subgraph Postgres
    CMS[(cms schema<br/>Payload, NO migrations)]
    APP[(app schema<br/>Drizzle, migrations 0000-0005)]
  end
  S3[(S3: credentials not wired)]
  SMTP[(SMTP: unset locally)]
  P --> C --> PL --> CMS
  M --> RH --> G --> APP
  RH --> AP --> APP
  AP --> EM --> SMTP
  AP --> ST --> S3
  A --> PL
  A --> AP
  P --> T --> APP
  RH --> RL --> APP
  PL -. lab-bookings read: public .-> Browser
  classDef pub fill:#eef;classDef mem fill:#efe;classDef stf fill:#fee
```

**Data flow:**
- **Enters** through public forms (signup, auth), member actions (onboarding, answers, uploads, registrations, bookings), staff (Payload and the review UI), and render-time analytics.
- **Processed** in `src/server/*`.
- **Stored** in Postgres (two schemas) plus S3 or local disk.
- **Reaches the frontend** through RSC server reads, with no client data fetching for primary content.

**External dependencies:** Postgres, SMTP, S3, Google OAuth (optional).

**When dependencies fail:**
- *DB down:*
  - Public list pages either render fabricated data or the error boundary, both with HTTP 200.
  - Auth guards return `null` (or a **fake founder in development**, `guards.ts:22-29`).
  - Lab-booking availability shows every slot free.
- *SMTP down or unset:* mail is logged.
- *S3 unavailable:* uploads 500.

**Critical to availability:** Postgres (single point of failure for everything, including the CMS).

**Coupling:**
- Payload and the app share one process and one database.
- Two connection pools per instance (DATA-14).
- Cross-schema IDs have no referential guard.

### Strengths to preserve
1. **Two-schema split** with stable-ID crossing; Payload is restricted to `cms` and drizzle-kit to `app`.
2. **Database sessions** (revocable), with roles re-read per request and `sessionToken` never exposed (`config.ts:36-62`).
3. **Payload local strategy disabled.** Staff authenticate only through the Auth.js session (`staff.ts:25`).
4. **Application engine:**
   - pure, tested transition table;
   - atomic idempotent `startApplication` (`onConflictDoNothing` + unique index);
   - transactional status + audit + notification;
   - email after commit.
5. **Uploads:** MIME allow-list plus magic-byte sniffing, random keys, production refuses local disk for documents.
6. **Rate limiter** is an atomic Postgres upsert, so it works across instances.
7. **Draft safety:** `overrideAccess:false` on every public CMS read.
8. **Route coverage:** consistent `loading.tsx` and `error.tsx` across most segments, plus a reusable `EmptyState` and centralised empty-state copy.
9. **Documentation quality.** The product docs and retrospectives are exceptional and self-critical, and they make this audit's reconstruction possible.

### Weaknesses and technical debt
| Debt | Evidence | Impact |
|---|---|---|
| Content layer conflates "no rows" with "error" and substitutes fiction | `startups.ts:34-42` and four siblings | KN-01 |
| Operational data placed in the CMS (lab bookings with user ID and email) | `lab-bookings.ts` | Breaks the documented data split; PII under CMS access rules |
| `'use server'` files export read helpers that trust a caller-supplied `userId` | `applications/actions.ts:19,264,279`; `events/actions.ts:63,78`; `notifications/actions.ts:15,23` | Latent IDOR the moment one is passed to a client component |
| No migrations for `cms`; missing `lab_admin` migration | No migration dir; `enums.ts:36` vs `0005_snapshot.json` | Irreproducible deploys |
| Dev-only branches in production code paths | `guards.ts:22-29`, `lab-booking.ts:29-34,73-79` | Masks failures; a bypass if `NODE_ENV` is misconfigured |
| No env validation | `payload.config.ts:83` `PAYLOAD_SECRET \|\| ''` | Silent misconfiguration |
| Check-then-act without locks | `actions.ts:184/250`, `review.ts:121-159`, `events/actions.ts:27-46`, lab-booking hook | Races (KN-13) |
| Design-system bypass in September UI | Hex literals in auth forms, undefined shadcn classes in booking form, missing `/noise.svg`, undefined `fill-down` keyframe | Visual inconsistency; broken selected states |
| Repo carries about 40k lines of unrelated design-kit material plus agent instructions | Section 04 | Noise; misleading rules (e.g. a "CI enforces" claim with no CI) |

### Structural recommendations
1. **Incremental, not a rewrite.** The foundation is sound; the defects are localised.
2. Make `src/server/content/*` return `[]` on empty and throw or log at error level on failure. Delete all `FALLBACK_*` except marketing copy.
3. Move read helpers that take `userId` into `server-only` modules that derive the user from the session.
4. Either move lab bookings into the `app` schema with a proper exclusion constraint, or pull the feature (HD-03).
5. Add Payload migrations and a single `migrate` step (Drizzle + Payload) to deploy.
6. Add a typed env schema (zod) that fails at boot in production.

---

## 08. SECURITY AND DATA INTEGRITY REVIEW

### Claims vs code
| Claim | Verdict |
|---|---|
| DB sessions, not JWT | VERIFIED(code) |
| `/admin` 404 to non-staff | VERIFIED(runtime, anonymous); VERIFIED(code) for both layouts |
| Roles re-read from DB each request | VERIFIED(code) |
| `guards.ts` is the only enforcement point; every action/handler calls a guard first | **CONTRADICTED**: lab booking uses ad-hoc `getSessionUser()`; `/api/analytics/track` has no guard; read helpers trust a `userId` param; Payload `access.ts` is a second (legitimate) enforcement layer |
| Disabled accounts lose access | **CONTRADICTED**: `isActive` is checked only at password login and in the Payload strategy, not in the session callback |

### Confirmed vulnerabilities (VERIFIED(code); runtime exploitation not attempted)
- **KN-02, P0 — public PII.** `src/payload/collections/lab-bookings.ts:12` has `read: () => true`. The fields include `userEmail` and `userId`, served by the Payload REST catch-all.
- **KN-03, P0 — dependency advisories (`pnpm audit`):**
  - Payload `<3.90.0`: field access-control bypass on auth collections; unauthorised update to collection documents; auth token handling (all critical). Also API-key disclosure, upload SVG/XML sanitisation, RCE via first-register, ReDoS (high).
  - Next `<16.3.8`: SSRF in image optimisation (high). The `next/og` RCE (critical) is **not applicable**, since `next/og` is unused (VERIFIED(code)). Payload `disableLocalStrategy` likely reduces the first-register exposure (INFERRED).
  - nodemailer (high): addressparser DoS, raw-option bypass.
  - sharp (high): librsvg CVE.
  - Remediation: Payload >= 3.90, Next >= 16.3.8, nodemailer >= 10.0.6, sharp >= 0.35.5. Re-test the Payload / Next peer range.
- **KN-07, P1 — seeds.** `src/db/seed.ts:56` sets the super_admin password to `SEED_PASSWORD ?? 'knest-dev-password'` in every environment. The default is published in the README. Re-running the seed overwrites the hash. `seed-demo.ts` has no production guard and creates more privileged demo logins.
- **KN-11, P1 — forgeable analytics.** `/api/analytics/track` accepts any event name and props from anyone, with no rate limit.
- **KN-22, P2 batch:**
  - **Login timing enumeration:** `DUMMY_HASH` is 59 characters, so bcryptjs returns early for unknown emails (VERIFIED: length 59).
  - **Signup enumeration:** distinct 400 vs 201 responses.
  - **Spoofable rate-limit key:** the first `x-forwarded-for` hop is used; there is no per-account login bucket.
  - **Unthrottled `/api/auth/password/verify/send`:** can be used to email-bomb any unverified address.
  - **Open redirect after login:** `login-form.tsx:36` accepts `//evil.com`.
  - **Upload body buffered before auth and size checks;** `questionId` not validated; orphaned files.
  - **No Origin check** on cookie-authenticated POST route handlers (only SameSite=Lax; sibling `*.kiit.ac.in` hosts are same-site).
  - **Weak CSP:** `script-src 'unsafe-inline'`; no HSTS or Permissions-Policy.
  - **Plaintext tokens:** verification and reset tokens stored in plaintext.
  - **Media permissions:** any staff role can replace public media.
  - **Admin input:** status `note` is not validated.
- **KN-10, P2:** a deactivated staff member keeps sessions and admin access for up to 30 days.
- **KN-09, P2:** the development auth bypass returns a mock founder when `auth()` throws (`guards.ts:22-29`).
- **KN-05 (security facet):** with SMTP unset, `email/send.ts:25-29` logs full bodies, including reset links (bearer tokens), with no production guard.

### Data integrity
| Issue | ID | Severity |
|---|---|---|
| Fabricated records indistinguishable from real ones | KN-01 | P0 |
| CMS delete or unpublish of a program 500s submit, save, review and status change (`program-questions.ts:15-23`, throwing `findByID`) | KN-12 | P1 |
| Double submit / post-submit edits; reviewer lost update; event overbooking; booking double-book | KN-13 | P2 |
| Submit validates presence only, not current question schema | KN-31 | P3 |
| `rate_limits` and `analytics_events` grow without pruning | KN-30 | P3 |

### Secrets
- No secrets are committed. History only ever added `.env.example`.
- The local `.env` holds unused Supabase keys, including a service-role key, plus a Vercel OIDC token in `.env.local`. These files are git-ignored. **Values were not read into this report.**
- Recommendation: delete the unused keys locally and rotate them if they were ever shared.

### Compliance
KNEST collects personal data from students (identity, onboarding answers, application answers, uploaded documents). India's **Digital Personal Data Protection Act 2023** is plausibly applicable to a university platform operating in India. Applicability, data fiduciary role and retention obligations need legal confirmation (HD-06). Today there is no privacy notice (the `/privacy` link 404s), no retention policy, no deletion workflow, and raw search text is stored in analytics. **No certification is implied by any control present.**

---

## 09. PERFORMANCE, SCALABILITY, AND RELIABILITY REVIEW

**Workload requirements:** none documented. A plausible envelope is a single university, thousands of students and application spikes around program deadlines (INFERRED). Nothing has been measured; **no load or capacity test exists.**

| Topic | Finding | Matters today? |
|---|---|---|
| N+1 queries | Four named N+1 issues fixed in 10-12.7 (retro, with instrumentation). One remains: `listRegisteredEventsForUser` (DATA-18). | Low |
| Connection management | Drizzle pool (max 10) plus a separate Payload pool per instance. On serverless this means up to about 20 connections per warm instance, with no pooler configured (INFERRED). | **Yes, if on Vercel**: exhaustion risk at modest concurrency |
| Render-path work | `track()` is awaited inside page renders (`page.tsx:30`), adding a session lookup and an insert before the homepage, program, resource, startup and search pages render. | Moderate (latency) |
| Images | Raw `<img>` hero, 944 KB JPEG, no dimensions; six more JPEGs of 800-900 KB. Framer Motion hides the hero `h1` until hydration. | Likely LCP/CLS cost (INFERRED; not measured) |
| Upload limits | App allows 10 MB; Vercel function bodies cap at about 4.5 MB (INFERRED). | Yes on Vercel |
| Concurrency | Races in submit, review, event capacity, booking (KN-13) | Yes at deadline spikes |
| Idempotency | `startApplication` idempotent (good). Submit, register and analytics events are not. | Yes |
| Timeouts / retries | SMTP send awaited in-request after commit, with no timeout; a slow SMTP server can time out the function after data is committed | Moderate |
| Observability of failure | DB outage produces fabricated pages or HTTP-200 error pages; `console.warn` only | **Yes** (KN-21) |
| Single points of failure | Postgres (CMS + app + sessions + rate limits) | Accept for this scale; needs backups + monitoring |

**What happens when:**
| Event | Behaviour |
|---|---|
| DB unavailable | Fiction or an error page with HTTP 200; logged-out appearance |
| Third-party (SMTP) fails | Email lost silently; user still sees success |
| Restart | Stateless app; fine |
| Event received twice | Duplicate analytics, duplicate submit notifications |
| Network timeout on client | Auth buttons hang |
| Invalid input | Generally zod-validated, except admin status note, lab booking and analytics |
| Stale dependency data | Fallback taglines, deadlines and `Date.now()+14d` fake events |
| Concurrent edits | Lost updates (KN-13) |
| Traffic increase | Connection pools first (INFERRED) |

**Missing validation:**
- A load test of the apply and submit path at deadline concurrency.
- A connection-count test on the target platform.
- Lighthouse / Core Web Vitals on the production build at a real URL.

---

## 10. ANALYTICS, BI, AND DASHBOARD REVIEW

**Instrumentation.** 13 server-side event types, stored in `app.analytics_events`. There is no third-party analytics, RUM or error tracking. A separate BI platform (e.g. Power BI) is **not justified** at this stage: volumes are small and the questions are funnel questions answerable in SQL from `applications` plus events.

**Which metrics cannot be trusted:**
- **Every count is forgeable** through the open `/api/analytics/track` endpoint (ANL-01), including `application_accepted` and the North Star "Activated Builders".
- **Anonymous identity does not persist.** The `knest_sid` cookie cannot be set during RSC render, so every landing, program and search view gets a fresh session ID. Visitor-level conversion cannot be computed (ANL-02).
- **Duplicates:**
  - `event_register` fires on conflict no-ops;
  - `onboarding_completed` fires on every repeat completion;
  - view events fire on every refresh;
  - **`application_start` fires on page view** because viewing `/apply/[program]` creates a draft (ANL-03, DATA-17).
- The build log shows **`track()` attempting an insert during static prerender** (`landing_view`). Build-time and bot traffic pollute the data whenever a DB is reachable at build time (VERIFIED(runtime)).
- **Google OAuth signups are never tracked** (ANL-05).

**Dashboard quality.** `/admin/analytics` shows all-time raw counts grouped by event name. It has:
- no date window;
- no distinct users;
- no conversion rates;
- no freshness indicator;
- no reconciliation with `applications`.

The empty-state check uses the total count, so junk events hide "no activity". Payload's `BeforeDashboard` labels unfiltered counts as "Active Startups" and "Upcoming Events" (ANL-08). Public metrics are hardcoded or fabricated, and the Metrics collection is unused (ANL-07). The ecosystem space figure appears three ways: "10,000-15,000", "Over 15,000" and "15,000+".

### Analytics coverage matrix
| Business objective | KPI | Metric definition | Required event / data | Current implementation | Validation | Gap | Priority |
|---|---|---|---|---|---|---|---|
| Acquire | Landing sessions | distinct anon sessions/day | `landing_view` + persistent sid | Partial | None | sid not persisted; bots/prerender | P2 |
| Activate | Signup rate | signups / landing sessions | `signup` (all providers) + stitching | Partial | None | OAuth missing; no stitching | P2 |
| Activate | Onboarding completion | completed / signed up | per-step + completion (once) | Completion only, duplicated | None | Step drop-off; dedupe | P2 |
| **Convert (primary)** | Submitted applications per program | `applications.status != draft` by program | **business table** (authoritative) | Event-based, forgeable | None | Compute from `applications`, not events | **P1** |
| Convert | Start -> submit rate | submitted / started-by-action | explicit start action | Start = page view | None | Fix DATA-17 | P1 |
| Outcomes | Acceptance rate, time to decision | from `applications` + `audit_logs` | business tables | Accepted event only | None | Use tables | P2 |
| Engage | Event registrations / attendance | registrations, attended | `event_registrations` | Event duplicated | None | Use table; attendance absent | P3 |
| Operate | Review queue age | submitted -> first transition | `audit_logs` | None | — | Add | P2 |
| Credibility | Public ecosystem metrics | sourced, dated | Metrics collection | Unused; hardcoded | — | Wire or remove | P1 |
| Health | Errors, Web Vitals | — | error tracking / RUM | None | — | Add | P1 |

**Minimum sufficient event taxonomy (recommended).** Keep `landing_view` (sid set in middleware/proxy), `signup` (all providers, via Auth.js `events.createUser`), `onboarding_step_completed {step}`, `onboarding_completed` (once), `program_view`, `application_started` (explicit action), `journey_selector_choice` (the only client-writable event, allow-listed and rate-limited) and `search_performed` (no raw text).

Derive submissions, decisions and registrations **from business tables, not events**. Drop vanity counts. Add a retention window.

---

## 11. UX AND DESIGN REVIEW

| Class | Findings |
|---|---|
| **Critical usability blockers** | Fabricated programs and mentors that 404 when clicked (KN-01); legal links 404; contact pathways for mentors, investors and partners point at missing anchors (J4-J6); Google button errors when unconfigured (KN-15) |
| **High-friction workflows** | Intent lost after signup and onboarding (KN-14); onboarding final CTA ignores the recommended path; auth buttons hang on network errors; lab booking has no confirmation view; `/dashboard/events` and `/search` unreachable |
| **Important improvements** | 3 `h1`s on the homepage; custom radio groups lack arrow-key semantics; oxblood-on-ink text at **1.8:1** contrast (computed from tokens `#7a1f2b` on `#0d1321`; fails 4.5:1 and 3:1) in `the-journey.tsx` and on the About page outcome numbers; Framer Motion ignores `prefers-reduced-motion` (no `MotionConfig`/`useReducedMotion`); form errors in one banner rather than per field; loading reuses the disabled styling |
| **Cosmetic / consistency** | Hex literals and raw Tailwind palette classes in September UI; undefined shadcn classes; emoji in the booking form (against the project rule); mixed radius language; missing `/noise.svg`; small footer and "Forgot password?" targets |

**Copy and brand drift (needs owner and institutional decision, HD-04):**
- The hero changed from the spec's reader-centred line to "THE MOST DANGEROUS THING YOU CAN DO IS GRADUATE WITH JUST A DEGREE" on a university's official platform.
- Auth pages say "Founder Portal" for every role, with an invented quote attributed to "KIIT University".
- Copy promises "capital", "direct grants", "cloud credits", "Hardware Labs" and "co-founder matchmaking".
- The About page shows "Top Tier / Global Ranking" and "100% / Incubation Pipeline" as target metrics, against `CONTENT_SPEC`'s rule that goals are never shown in metric form.
- A named individual's email is hardcoded on the About page. Prefer a role mailbox.

**Strengths:**
- Skip link, `aria-current`, Escape-to-close mobile nav with focus return, global `:focus-visible`.
- `Field` component wires `aria-describedby` and `aria-invalid`; password toggle labelled by state.
- Correct `autocomplete` attributes (password-manager friendly; meets WCAG 3.3.8).
- No horizontal overflow at 375 px (runtime).

---

## 12. QA, TESTING, AND REGRESSION REVIEW

**Executed:** `pnpm test` gives 3 files, **20 tests, 20 passed, 0 failed, 0 skipped** (Node, vitest 4.1.11). Coverage was not measured; no coverage tooling is configured.

**What the tests verify:**
- `transitions.test.ts` (7): transition legality;
- `roles.test.ts` (6): role -> area access (the `analytics` and `infrastructure` areas are not asserted);
- `recommend.test.ts` (7): role x stage -> path.

All are pure functions. **Nothing** touches the DB, route handlers, guards, sessions, uploads, the rate limiter, file sniffing, analytics or content fallbacks.

**Would automation catch a serious regression in core functionality?** **No.** Two of the most severe historical defects (a production cookie-name mismatch and a standalone build with no static assets) were found only by a manual production-build pass (retro 10-12, section 3). The September regressions (fabricated content, PII exposure, missing migration, broken lint, lost `next` intent) would all pass the current suite. There is no CI at all.

**Also:**
- `scripts/verify-*.sh` are manual curl scripts against `pnpm dev`.
- Lighthouse and axe were run ad hoc in August and discarded.
- `@axe-core/playwright` and `lighthouse` are unused devDependencies.
- ESLint crashes.

### Test gap matrix (risk-based)
| Area | Risk | Existing | Gap | Recommended |
|---|---|---|---|---|
| Production build boots + golden path | Critical | None | Everything | CI smoke: `build` -> start -> Playwright golden path against a Postgres service container |
| Auth/session/cookie naming, token single-use, reset revokes sessions | Critical | Manual script | All | Integration (DB) |
| Guards / authorization boundary per route (incl. events, notifications, lab booking, Payload REST collections) | Critical | `roles.test.ts` (pure) | Route-level 401/404, object-level ownership | Integration; table-driven |
| Content layer empty vs error | High | None | Fallback regression | Unit with mocked Payload |
| Application start/submit/review incl. concurrency | High | Transitions only | Idempotency, double submit, lost update | Integration + parallel requests |
| Uploads: magic bytes, size, storage | High | None | `verifyFileContents`, S3 path | Unit + integration |
| Rate limiter math | Medium | None | Bucket refill/floor | Unit / integration |
| Analytics allow-list and funnel SQL | Medium | None | Forgery, dedupe | Integration |
| Accessibility on public routes | Medium | Ad-hoc August run | Repeatable | axe-playwright in CI |
| Migrations apply to empty DB (Drizzle + Payload) | Critical | None | All | CI job |

---

## 13. INFRASTRUCTURE AND OPERATIONS REVIEW

| Capability | State | Evidence |
|---|---|---|
| Local setup | Partially reproducible: Docker Postgres, migrate, seed, dev | The README is accurate for local use, but its "Status" section is stale (says Phase 0 complete) and references a non-existent `src/server/services/` |
| Environment separation | Unclear | Single `.env`; unused Supabase keys; Vercel env pulled locally |
| CI/CD | **None** | No `.github/` |
| Build reliability | Build passes (runtime) | `pnpm.overrides` is ignored by pnpm 10 (runtime warning), so the documented `pg` pin is not enforced. A single `pg@8.23.0` currently resolves. |
| Deployment mechanism | Contradictory (KN-06) | `next.config.ts:35` vs README |
| Migrations in deploy | Manual Drizzle; **no Payload migrations** (KN-04) | |
| Secrets | Env files locally; nothing committed | No secret manager evidence for production |
| Env validation | None | `PAYLOAD_SECRET \|\| ''` |
| Health check | None | No `/api/health` |
| Logging | `console.*` only (about 20 sites), unstructured | |
| Error reporting / alerting | None | Error page claims "We've been told about it" |
| Metrics / tracing | None | |
| Backups / restore | Not documented | Platform-dependent; UNVERIFIED |
| Rollback | Code rollback possible on Vercel (INFERRED); DB forward-only, no down migrations | |
| Ownership / runbooks | None | |

**Can a new engineer set up, understand, test and maintain this?**
- Set up locally: **yes**.
- Understand: **yes**, given the docs, which are a real asset.
- Test confidently: **no**.
- Deploy reproducibly: **no**.

**Can a failed release be detected and reversed?**
- Detected: **no** (no error tracking, health check or alerting).
- Reversed: code, **partially**; schema, **no**.

---

## 14. ENTERPRISE CAPABILITY APPLICABILITY MATRIX

| Capability | Classification | Reason |
|---|---|---|
| Multi-user accounts | REQUIRED NOW (present) | Core |
| RBAC (2 axes, coarse) | REQUIRED NOW (present) | Fix `isActive` and the `lab_admin` migration |
| Object-level authorization | REQUIRED NOW | Mostly present; fix KN-02 and `'use server'` read helpers |
| Audit trail | REQUIRED NOW (present for status changes) | Extend to role changes and deactivation |
| Privacy notice, terms, data deletion, retention | REQUIRED BEFORE EXTERNAL LAUNCH | Student personal data; DPDP applicability (HD-06) |
| Error monitoring, health check, alerting | REQUIRED BEFORE EXTERNAL LAUNCH | Currently blind |
| Backups + tested restore | REQUIRED BEFORE EXTERNAL LAUNCH | Single Postgres holds everything |
| Rate limiting / abuse prevention | REQUIRED NOW (partially present) | Fix key derivation and unthrottled endpoints |
| CI quality gates | REQUIRED NOW | None exist |
| SSO (KIIT Google Workspace / institutional IdP) | NEEDS BUSINESS DECISION | Google provider exists; KIIT IdP unknown (HD-10) |
| Data exports (applications CSV for reviewers) | REQUIRED AT LATER SCALE | Staff will ask for it at the first cohort; cheap |
| Approval workflows (bookings) | NEEDS BUSINESS DECISION | Only if lab booking stays (HD-03) |
| Feature flags | OPTIONAL | Env flag enough for lab booking/blog |
| Multi-tenancy / tenant isolation | NOT APPLICABLE | Single institution |
| Billing / subscriptions / usage quotas | NOT APPLICABLE | Free university service |
| Public API access | NOT APPLICABLE | No consumer |
| SLOs | REQUIRED AT LATER SCALE | Define after launch baseline |
| Separate BI platform | NOT APPLICABLE now | SQL on `app` suffices |
| Compliance certification (SOC 2/ISO) | NOT APPLICABLE | No contractual driver evidenced |

---

## 15. CONSOLIDATED FINDINGS REGISTER

Stable IDs: `KN-xx`. Source cross-references: SEC-, DATA-, UX-/FE-/A11Y-, ANL-/QA-/OPS-.

Effort bands assume one engineer familiar with the codebase. S is up to 1 day, M is 2-5 days, L is 1-3 weeks. The basis is file and line counts touched plus test work; no velocity data was available.

| ID | Cat | Sev | Finding | Evidence | Impact | Recommended action | Effort | Verification required | Owner |
|---|---|---|---|---|---|---|---|---|---|
| KN-01 | Data integrity / product | **P0** | Fabricated startups, mentors (some attributed to real companies), programs, events and bylined articles render when the CMS is empty **or** errors; filters ignore fallbacks; fallback slugs 404 | `server/content/startups.ts:34-42`, `programs.ts:20-55`, `mentors.ts:25-56`, `events.ts:43-75`, `articles.ts:16-117`; runtime `/blog`; introduced `c72d2d9`, `4cc124f` | Misrepresentation by a university; legal/reputational risk; real data indistinguishable; dead clicks | Delete `FALLBACK_*` except marketing copy; return `[]`; let `EmptyState` render; log at error level | S | Unit tests (empty vs error); visual check of each list page with an empty CMS | Eng + Product |
| KN-02 | Security | **P0** | Lab-booking collection world-readable incl. `userEmail`, `userId` | `payload/collections/lab-bookings.ts:12` | Bulk PII harvest | `read: canWrite('infrastructure')`; expose free/busy only through the server action | S | Anonymous `GET /api/lab-bookings` returns 403/empty on staging | Eng |
| KN-03 | Security | **P0** | Payload 3.88.0 / Next 16.3.3 / nodemailer / sharp match critical and high advisories | `pnpm audit --prod` (4C/21H) | Access-control bypass classes in the CMS | Upgrade Payload >= 3.90, Next >= 16.3.8, nodemailer >= 10.0.6, sharp >= 0.35.5; regression test | M | Audit clean of criticals; golden path passes | Eng |
| KN-04 | Ops / architecture | **P0** | No Payload migrations (prod never gets `cms`); `lab_admin` enum has no migration; migrations manual | No migrations dir; `@payloadcms/db-postgres/dist/connect.js:110`; `enums.ts:36` vs `0005_snapshot.json` | Irreproducible deploys; role assignment fails in DB | `payload migrate:create` baseline; Drizzle migration for the enum; one deploy-time migrate step | M | Migrate an empty DB from zero in CI | Eng |
| KN-05 | Reliability / security | P1 (P0 if prod lacks config) | No SMTP -> bodies incl. reset tokens logged and users can't verify (and can't submit); S3 client never receives credentials; Media writes to local disk; 10 MB limit vs serverless body cap | `email/send.ts:25-29`; `storage/index.ts:17,28,47`; `collections/media.ts`; `actions.ts:146` | Core loop blocked; token leakage to logs | Fail boot in prod without SMTP/S3; never log bodies; pass credentials or use the platform role; add `@payloadcms/storage-s3`; presigned uploads | M | Staging: verify email received, upload succeeds, media persists | Eng + Ops |
| KN-06 | Architecture | P1 | Deployment target contradictory (AWS docs vs Vercel config); unused Supabase keys | README:114-127; `next.config.ts:35`; `.vercel/project.json`; `.env` names | Every platform assumption uncertain | Decide (HD-01); update README/ARCH; remove unused keys | S (decision) + M (alignment) | Docs match deployed reality | Owner + Eng |
| KN-07 | Security | P1 | Seeds create super_admin with a public default password in prod and overwrite the hash; demo seeds unguarded; `patch_seed.mjs` breaks seed | `seed.ts:56-63`; `seed-demo.ts:217-226`; README:46-48 | Known-credential admin | Refuse prod without `SEED_PASSWORD`; never overwrite existing; hard-fail demo seeds in prod; delete `patch_seed.mjs` | S | Run seed with `NODE_ENV=production` and no password: it exits | Eng |
| KN-08 | Product scope / functional | P1 | Lab booking shipped against spec; no server-side role, validation or rate limit; check-then-insert overlap; dev fake success; undefined styling classes; emoji; no "my bookings"; no approval notification; UTC date default | `server/actions/lab-booking.ts`; `dashboard/lab-booking/*`; ARCH section 7 | Abuse (block a lab indefinitely); inconsistent UX; scope creep | Decide (HD-03). If kept: move to `app` schema with exclusion constraint, zod, role guard, my-bookings, notifications. Else feature-flag off | M-L | Concurrency test; staff approval flow | Product + Eng |
| KN-09 | Security | P2 | Development auth bypass: mock founder on `auth()` failure | `guards.ts:22-29` | Hides failures; bypass if env is misconfigured | Remove; use seeded dev user | S | — | Eng |
| KN-10 | Security | P2 | `isActive` not enforced on sessions; no revoke on disable or demote | `config.ts:37-61`; `actions.ts:179` | Deactivated staff retain access | Check in session callback; revoke on disable; `signIn` callback | S | Integration test | Eng |
| KN-11 | Analytics | P1 | Open, unvalidated, unthrottled analytics endpoint; non-persistent anon id; duplicates; `application_start` on page view; prerender inserts; OAuth signup untracked; all-time-only dashboard | `api/analytics/track/route.ts:11-17`; `track.ts:26-36`; `events/actions.ts:43-48`; `apply/[program]/page.tsx:25`; build log | No trustworthy KPI | Allow-list + zod + rate limit; sid in middleware/proxy; compute outcomes from tables; date windows | M | Funnel reconciles with `applications` on staging | Eng + Analytics |
| KN-12 | Data integrity | P1 | Deleting or unpublishing a program 500s submit, save, review and status change | `applications/program-questions.ts:15-23` | Staff can't close out applications | Non-throwing lookup; block delete when applications exist; archive status | S-M | Integration test | Eng |
| KN-13 | Data integrity | P2 | Races: double submit / post-submit edits; reviewer lost update; event over-capacity; booking double-book | `actions.ts:184,250`; `review.ts:121-159`; `events/actions.ts:27-46` | Duplicate notifications; illegal net transitions; overbooking | Conditional updates (`WHERE status=...`) + row-count check; lock or constraint for capacity | M | Parallel-request tests | Eng |
| KN-14 | UX / functional | P1 | Intent (`next`) lost through onboarding; completion result ignored (loop on failure); CTA ignores recommended path | `onboarding/page.tsx`; `onboarding-flow.tsx:378` | Breaks J2 ("land back on the application") | Thread `next`; handle result; route to `result.path` | S | E2E J2 | Eng |
| KN-15 | Functional | P1 | Google button always shown | `login-form.tsx:8`, `signup-form.tsx:8` (prop unused) | Error page on the primary CTA | Restore `googleEnabled` guard | S | Visual check with and without env | Eng |
| KN-16 | Functional / legal | P1 | `/privacy`, `/terms` 404; `#contact`/`#partner` anchors missing; blog cards link to `/resources`; `/search`, `/dashboard/events` unlinked; `/profile` missing | Runtime crawl; `site-footer.tsx:98,101`; `blog/page.tsx:27-29` | Legal exposure; dead CTAs for mentor, investor and partner journeys | Create legal pages (HD-06); real contact pathway (HD-14); fix links | S-M | Link crawl in CI | Product + Eng |
| KN-17 | Product honesty | P1 | Hardcoded fake course progress on dashboards | `student-view.tsx:31-35`; `founder-view.tsx:104-109` | New users told they completed non-existent courses | Remove or back with real data | S | — | Eng |
| KN-18 | Product / brand | P1 | Unapproved homepage, auth and About copy; inconsistent "sq. ft." claims; target metrics in metric form; spec hero replaced; promises of capital, grants, co-founder matching | Section 11; `the-journey.tsx:29`; `about/page.tsx:83-87`; `ecosystem/page.tsx:43,205`; `execution-flow.tsx:324` | Institutional over-claiming | Institutional copy review (HD-04); reconcile with `CONTENT_SPEC` or update the spec | S (eng) | Sign-off record | Product + KIIT comms |
| KN-19 | Accessibility | P1 | 1.8:1 contrast; motion ignores reduced-motion and hides content pre-hydration; 3 `h1`s; radio groups without keyboard model; weak focus on inputs | `the-journey.tsx`; `reveal.tsx:21`; `reveal-heading.tsx:11`; `option-list.tsx`; `field.tsx:66` | WCAG 2.2 AA failures (1.4.3, 2.3.3-related, 1.3.1, 2.1.1) | Light accent token on dark; `MotionConfig reducedMotion="user"` + visible SSR state; heading levels; roving tabindex | M | axe + keyboard pass in CI; manual screen reader | Eng + Design |
| KN-20 | QA | P1 | No CI; ESLint crashes; 20 pure tests only; verify scripts manual | Runtime lint crash; no `.github/` | Regressions ship unnoticed (they already have) | CI: install, typecheck, lint (eslint 9 flat config), unit, migrate-from-zero, build, smoke E2E, axe | M | Green pipeline required to merge | Eng |
| KN-21 | Ops | P1 | No error reporting, health endpoint or alerting; error page claims "we've been told"; failures return HTTP 200 (streaming) | Runtime `/programs` with DB down; no `/api/health` | Outages invisible | Add error tracking, `/api/health` (DB ping), uptime check; honest error copy | S-M | Induced error appears in tracker | Eng + Ops |
| KN-22 | Security | P2 | Hardening batch: login timing and signup enumeration; spoofable XFF key and no per-account bucket; unthrottled verify/send; open redirect; upload buffering and `questionId`; no Origin check; `unsafe-inline` CSP, no HSTS; plaintext tokens; media update by any staff; admin note unvalidated; `'use server'` read helpers trusting `userId` | Section 08 | Cumulative attack surface | Address as one hardening sprint | M | Security regression tests | Eng |
| KN-23 | Scalability | P2 | Two pools per instance, no pooler | `db/client.ts`; `payload.config.ts:86` | Connection exhaustion on serverless | Pooler URL; `max` 1-3; share pool | S | Connection count under load | Eng |
| KN-24 | Engineering | P2 | Design-system bypass (hex, raw palette, undefined classes, missing asset, undefined keyframe, emoji) | Section 11 | Inconsistency; broken selected states | Token-only lint; fix assets | S-M | Visual regression | Eng + Design |
| KN-25 | Performance | P2 | Large unoptimised hero images; content hidden until hydration; `track()` awaited in render | `hero.tsx:50`; `page.tsx:30` | Probable LCP/CLS and latency cost (unmeasured) | `next/image`; non-blocking tracking | S | Lighthouse on staging | Eng |
| KN-26 | SEO | P2 | No sitemap, robots, OG, `not-found`, `global-error` | Runtime 404s | Discoverability; poor share previews | Add `sitemap.ts`, `robots.ts`, OG defaults | S | Fetch checks | Eng |
| KN-27 | Hygiene / docs | P3 | Stale README status and deploy section; 16.6 MB PDF tracked; about 40k lines of unrelated design kit; `.gitignore` ignores `AGENTS.md`/`CLAUDE.md`; `pnpm.overrides` ignored by pnpm 10; `patch_seed.mjs` | Section 04; build warning | Confusion; misleading agent rules | Update README; move kit to its own repo (HD-11); move overrides to `pnpm-workspace.yaml` | S | — | Eng |
| KN-28 | Dependencies | P3 | `next-auth` pinned beta; eslint 8 EOL; unused `lighthouse`, `@axe-core/playwright` | `package.json` | Upgrade risk | Track Auth.js v5 GA; eslint 9 | S | — | Eng |
| KN-29 | Privacy | P3 | Raw search text stored indefinitely; no retention for analytics or rate limits | `search/page.tsx:22` | PII in analytics | Drop or hash text; retention job | S | — | Eng |
| KN-30 | DB | P3 | Missing `event_id`/`created_at` indexes; redundant index; N+1 in registered events | DATA-18 | Minor | Index changes via migration | S | — | Eng |
| KN-31 | Data integrity | P3 | Submit validates presence only; apply page view creates draft (CSRF-able by navigation) | `actions.ts:223-230`; `apply/[program]/page.tsx:25` | Stale or invalid answers accepted; funnel inflation | Re-validate at submit; explicit start action | S | — | Eng |
| KN-32 | Analytics | P3 | Payload dashboard counts mislabelled; Metrics collection unused | `BeforeDashboard.tsx:10-14` | Misleading staff view | Filter counts or relabel; wire or remove Metrics | S | — | Eng |
| KN-33 | Delivery | **P0** | The August retrospective's own launch blockers (real staging deploy over HTTPS, XFF behaviour, repeatable a11y script, unit tests) were never done; September commits labelled "launch readiness" did not address them | `PHASE-10-12-RETROSPECTIVE.md` section 9 | Two prior total-outage bugs were found only by a production build; the real target has never been exercised | Stage 7 gate (section 18) | M | Golden path on staging, recorded | Eng + Owner |
| KN-34 | Email | P3 | Email bodies use relative paths; SMTP awaited in-request with no timeout; deadline compared as an instant (timezone UNVERIFIED) | `templates.ts`; DATA-19/20 | Unusable links; timeouts after commit | Absolute URLs; queue or timeout; date-only end-of-day IST | S | — | Eng |

**Quick wins (S effort, high value):** KN-01, KN-02, KN-07, KN-09, KN-14, KN-15, KN-17, KN-23, KN-26, plus link fixes in KN-16.

**Foundational:** KN-03, KN-04, KN-05, KN-06, KN-11, KN-13, KN-20, KN-21, KN-33.

**Complexity reduction:**
- Remove the fallback data (about 500 lines).
- Delete `patch_seed.mjs`, `seed-dummy*`, and the dead homepage components (`BuiltWithKnest`, `TheEcosystem`).
- Move the design kit out of the repo.
- Drop the unused Supabase configuration.
- Either delete lab booking or make it a properly bounded module.

---

## 16. STAKEHOLDER FEEDBACK (PHASE M)

**PENDING INPUT.** No stakeholder feedback was supplied with this engagement or found in the repository.

When it is supplied, each item should be assessed for:
- the problem it describes and whether that problem is evidenced;
- alignment with section 03;
- current implementation state;
- conflicts with recorded requirements;
- a simpler alternative, cost and risk;
- a recommendation (accept, modify, defer, test or reject).

All of these remain pending owner authorisation.

---

## 17. PRODUCT COMPLETENESS AND READINESS SCORECARD

Scale: 0 (absent or broken) to 5 (release-quality, validated). **NOT ASSESSED** means the evidence was insufficient.

| # | Dimension | Score | Rationale | Evidence | Confidence | Critical gaps | Next validation |
|---|---|---|---|---|---|---|---|
| 1 | Scope clarity | 3 | Exceptional written spec, but September changes bypassed it and the hosting decision is contradictory | Section 03 | High | HD-01, HD-03, HD-04 | Owner sign-off on Section 03 |
| 2 | Product completeness | 2 | Core loop exists in code; `/profile`, contact pathways and legal pages missing; public surface polluted | Sections 05, 06 | Medium | KN-01, KN-16 | Golden path on staging |
| 3 | Functional correctness | 2 (code-only) | Sound engine, but several incorrect behaviours confirmed in code; nothing DB-backed observed at runtime | Section 06 | Low | KN-12, KN-13, KN-14 | Integration + E2E suite |
| 4 | UX quality | 2 | Good shell and a11y primitives; dead ends, misleading content, contrast and motion failures | Section 11 | Medium | KN-16, KN-19 | Usability test with 5 students |
| 5 | Engineering quality | 3 | August code is disciplined; September code regressed (dev mocks, `as any`, bypassed tokens) | Section 07 | High | KN-09, KN-24 | Lint + review gate |
| 6 | Architecture suitability | 3 | Right shape for the problem; platform mismatch and CMS-held operational data | Section 07 | Medium | KN-06 | Decision record |
| 7 | Security | 2 | Strong session design; public PII, vulnerable deps, seed credentials, hardening gaps | Section 08 | High (code) | KN-02, KN-03, KN-07 | Post-fix review + dependency audit |
| 8 | Data integrity | 1 | Fabricated records, races, CMS deletion breaks, no cms migrations | Sections 08, 15 | High | KN-01, KN-04, KN-12 | Migration-from-zero + concurrency tests |
| 9 | Analytics reliability | 1 | Forgeable, non-stitched, duplicated; dashboard all-time only | Section 10 | High | KN-11 | Reconciliation query vs `applications` |
| 10 | Scalability | NOT ASSESSED | No workload requirements, no measurements | Section 09 | — | Pools (KN-23) | Load test at deadline concurrency |
| 11 | Testing | 1 | 20 pure tests; no integration, E2E or CI; lint broken | Section 12 | High | KN-20 | CI pipeline |
| 12 | Operational readiness | 1 | No monitoring, health check, backups or runbooks | Section 13 | High | KN-21 | Induced-failure drill |
| 13 | Documentation | 3 | Product docs excellent; README status and deploy sections stale | Section 13 | High | KN-27 | README refresh |
| 14 | Deployment and rollback | 1 | Platform unclear; no cms migrations; no rollback for schema; never staged | Section 13 | Medium | KN-04, KN-33 | Staging deploy from empty DB |

**Aggregate:** an unweighted mean of the 13 assessed dimensions is about **1.9 / 5**. Limitations:
- Scalability is not assessed.
- Functional correctness is code-only.
- Equal weighting understates security and data-integrity risk.

Treat the dimension scores, not the mean, as the decision input.

**Readiness classification: NOT READY FOR DELIVERY.**
- **Basis:**
  - three P0 defects confirmed in code (KN-01, KN-02, KN-04);
  - one P0 dependency exposure confirmed by audit (KN-03);
  - no successful end-to-end run on any production-like environment (KN-33).
- **Path to "Ready for controlled pilot":** Stages 0-2 and the Stage 7 gate.
- **Path to "Ready for production with conditions":** additionally Stage 5's monitoring and backups, plus the privacy notice.

---

## 18. RECOMMENDED TARGET STATE

**Retain:**
- two-schema architecture;
- DB sessions;
- guard module;
- application engine and transition table;
- rate limiter;
- file verification;
- `EmptyState` and empty-state copy system;
- loading and error boundaries;
- rule-based recommender;
- the docs and retrospective discipline.

**Repair:**
- content layer (KN-01);
- lab-booking access (KN-02);
- dependencies (KN-03);
- migrations (KN-04);
- email and storage config (KN-05);
- seeds (KN-07);
- onboarding intent (KN-14);
- Google guard (KN-15);
- links (KN-16);
- races (KN-13);
- analytics endpoint (KN-11);
- accessibility (KN-19).

**Redesign:**
- Analytics: derive outcomes from business tables; minimal event taxonomy (Section 10).
- Lab booking, if kept: `app`-schema module with a policy, exclusion constraint and approval flow.
- Homepage/About claims: institutional review.

**Remove:**
- all `FALLBACK_*` data records;
- fake dashboard progress;
- dev auth mock and dev fake-success branches;
- `patch_seed.mjs`, `seed-dummy*`;
- dead homepage components;
- unused Supabase config;
- the design kit (move to its own repo).

**Add:**
- CI;
- error tracking and health check;
- env validation;
- Payload migrations;
- privacy and terms pages;
- a contact pathway;
- `sitemap`/`robots`;
- a staging environment;
- backup and restore procedure.

**Explicitly do not build now:**
- investor dashboard;
- mentor marketplace or booking;
- messaging or feed;
- co-founder matching;
- page builder;
- separate BI platform;
- multi-tenancy;
- billing;
- AI recommender.

These are the architecture doc's own exclusions, and nothing found here argues for reversing them.

---

## 18b. PROPOSED DELIVERY ROADMAP (not executed)

| Stage | Objective | Addresses | Deliverables | Depends on | Acceptance criteria | Tests | Release risks | Human decisions | Exit |
|---|---|---|---|---|---|---|---|---|---|
| **0** Resolve ambiguity + critical risks | Stop harm, decide platform | KN-01, 02, 03, 06, 07, 09, 17; HD-01-07 | Fallbacks removed; lab-bookings read locked (or feature flagged off); deps upgraded; seeds guarded; dev mocks removed; platform decision recorded | HD-01, HD-02, HD-03 | Empty CMS shows `EmptyState` everywhere; anonymous `/api/lab-bookings` denied; `pnpm audit` has no critical | Unit tests for content layer; dependency audit | Payload upgrade regressions | HD-01..07 | All P0 code findings closed |
| **1** Foundation + data integrity | Reproducible, correct persistence | KN-04, 05, 12, 13, 23, 31 | Payload + Drizzle migrations from zero; deploy migrate step; env schema; S3/SES (or equivalents) wired; conditional updates; non-throwing program lookup | Stage 0, HD-05 | Empty DB -> migrate -> seed -> app boots; concurrency tests pass | Integration (DB service), parallel-request tests | Migration of an existing prod DB (if any) | HD-05, HD-07 | Migrate-from-zero green in CI |
| **2** Close broken core journeys | J1-J3 complete | KN-14, 15, 16, 10 | `next` threaded; onboarding result honoured; Google guard; legal pages; contact pathway; links fixed | Stage 1, HD-06, HD-14 | E2E: signup -> verify -> onboard -> back to application -> submit -> staff review -> applicant sees status + email | Playwright E2E on production build | Email deliverability | HD-06, HD-14 | E2E green on staging |
| **3** Usability friction | Remove dead ends and misleading UI | KN-18, 19, 24, 25, 26; blog/search/profile decisions | Copy reconciled with signed-off content; a11y fixes; tokens only; images optimised; sitemap/robots | Stage 2, HD-04, HD-08, HD-09, HD-13 | axe zero serious/critical on public routes; contrast OK; keyboard pass | axe-playwright in CI; manual screen reader | Copy sign-off latency | HD-04, 08, 09, 13 | Sign-off + a11y gate |
| **4** Analytics + ops dashboards | Trustworthy KPIs | KN-11, 29, 32 | Allow-listed endpoint; sid middleware; table-derived funnel with date windows and freshness; retention job | Stage 1 | Funnel totals reconcile with `applications` for a test cohort | Integration | Privacy of event props | HD-12 | Reconciliation report |
| **5** Security, reliability, testing | Harden + observe | KN-20, 21, 22, 28, 34 | CI full; error tracking; health check; alerting; backups + restore drill; hardening batch | Stage 1 | Induced error alerts; restore drill documented; CI blocks merge | Security regression tests | Alert noise | — | Drill passed |
| **6** Applicable enterprise capabilities | Fit-for-purpose only | Section 14 "required before external launch" | Data deletion workflow, retention policy, staff deactivation flow, CSV export | Stage 5, HD-06 | Policy-backed workflows exist | Integration | Legal interpretation | HD-06, HD-10 | Owner acceptance |
| **7** Production-readiness validation | Prove the real target | KN-33 | Staging = production topology over HTTPS; golden path; load test at deadline concurrency; Lighthouse | Stages 0-5 | All exit criteria above on staging; P0/P1 register empty | Full suite + load | Platform surprises | Go/no-go | Signed go decision |
| **8** Release, observe, stabilise | Controlled pilot (one program, one cohort) | — | Pilot runbook; on-call owner; daily funnel and error review for 2 weeks | Stage 7 | No P0/P1 incidents open; applications reconcile | Monitoring | Real-user load | Pilot scope | Broader rollout decision |

**MUST SHIP:** Stages 0-2, the monitoring/backup part of Stage 5, privacy and terms, and the Stage 7 gate.
**SHOULD SHIP:** Stage 3 a11y and copy; Stage 4 analytics.
**POST-LAUNCH:** CSV export, SLOs, deeper hardening items (nonce CSP, token hashing), event attendance.
**OPTIONAL / NOT JUSTIFIED:** BI platform, multi-tenancy, billing, investor dashboard, mentor booking, page builder.

**Critical path:**
1. HD-01 (platform)
2. KN-04 (migrations)
3. KN-05 (email and storage)
4. KN-14 (journey)
5. E2E on staging (KN-33)
6. Pilot

**Parallelisable:**
- KN-01, 02, 03, 07, 17 (independent of the platform decision);
- the a11y and copy work (once HD-04 is decided);
- CI scaffolding;
- the analytics redesign.

**Sequential:** migrations before any data-touching fixes on staging; Payload upgrade before the migration baseline.

---

## 19. HUMAN DECISIONS REQUIRED

### BLOCKING
| ID | Question | Why it matters | Evidence | Options | Recommended | Consequences | Default if unresolved | Blocks? |
|---|---|---|---|---|---|---|---|---|
| HD-01 | What is the production hosting target and database, and is anything live today (URL)? | Storage, email, pooling, migrations, rate-limit IP keys and docs all depend on it | README AWS vs `next.config.ts:35`, `.vercel/`, Supabase keys | (a) Vercel + managed Postgres (Supabase/Neon) + S3/R2 + SES/Resend; (b) AWS ECS/RDS/S3/SES as documented | Whichever KIIT IT can operate and own. If no AWS operator exists, (a) is simpler; update docs either way | (a) needs pooler + external storage; (b) needs IaC and a container pipeline | Assume Vercel (current config) | **Yes**: Stages 1, 7 |
| HD-02 | Confirm the content-honesty rule still stands: no invented records, ever | KN-01 removal and the demo seed's future | ARCH section 6 vs September fallbacks | Keep rule / allow clearly-labelled sample content in non-prod only | Keep rule; demo seed local-only | Relaxing it risks institutional misrepresentation | Keep rule | **Yes**: Stage 0 |
| HD-03 | Lab booking: ship, pull, or rebuild with a policy? Who approves bookings? | Out of approved scope; has a P0 leak; needs an operational policy | ARCH section 7; `lab-booking.ts` | (a) Feature-flag off; (b) rebuild properly; (c) replace with "request a space" contact form | (a) now; (b) when a policy owner exists | (b) is M-L effort plus ongoing ops | Flag off | **Yes**: Stage 0 |
| HD-04 | Who at KIIT approves public claims and the homepage voice (hero line, "capital/grants", "15,000+ sq. ft.", rankings, quotes)? | Institutional over-claiming risk | Section 11; `CONTENT_SPEC` | Restore spec copy / approve new copy / revise | Restore spec copy until sign-off | Unapproved claims on an official university site | Restore spec copy | **Yes**: public launch |
| HD-05 | Email and file-storage providers and sender domain for production | Users can't verify or submit without them | KN-05 | SES / SMTP relay / Resend; S3 / R2 / Supabase Storage | Match HD-01 | Deliverability, cost | — | **Yes**: Stage 1 |
| HD-06 | Who owns privacy notice, terms, retention and deletion (DPDP Act applicability)? | Personal data of students; footer links 404 | KN-16, Section 08 | University legal drafts / adapt existing KIIT policy | Adapt the existing KIIT policy | Launching without a notice is legal exposure | — | **Yes**: external launch |
| HD-07 | Has any shared or prod database been seeded with the default admin password or demo seeds? | Credential and fiction exposure | KN-07 | Check and rotate / rebuild DB | Check, rotate, purge demo rows | — | Assume yes; rotate | **Yes**: Stage 0 |

### NON-BLOCKING
| ID | Question | Recommended | Default |
|---|---|---|---|
| HD-08 | Keep the blog (needs `/blog/[slug]` and real posts) or remove it from nav? | Remove until there are 3+ real posts; Resources covers playbooks | Remove from nav |
| HD-09 | Restore the `/search` link or drop the route? | Restore in header once real content exists | Leave unlinked |
| HD-10 | Enable Google sign-in (KIIT Google Workspace?) or institutional SSO later? | Enable only if KIIT uses Google Workspace; restrict domain optionally | Hide button |
| HD-11 | Move the design kit, agent skills and PDFs out of the app repo? | Yes, to a separate tooling repo | Leave |
| HD-12 | Is in-house funnel analytics sufficient, or is a third-party tool wanted (privacy trade-off)? | In-house, table-derived | In-house |
| HD-13 | Build `/profile` or remove it from the spec? | Minimal profile (name, role, stage, email prefs) | Remove from spec |
| HD-14 | What is the contact pathway for mentors, investors and partners (role mailbox, form, CRM)? | Role mailbox + simple form | Role mailbox link |
| HD-15 | Should the site reflect the newer brochure (`KNEST (1).pdf`: alumni pillar, MBA-IEV, KIIT TBI)? | Yes, via CMS content after HD-04 review | No change |

---

## 20. FINAL AUDITOR VERDICT

**Is the current approach fundamentally sound?** Yes. The architecture, data model, auth design and application engine are appropriate for a single-institution platform at this scale, and they are better reasoned than typical. A rewrite is **not** justified. Every serious defect found is localised and fixable incrementally.

**Is the project salvageable without major rework?** Yes. Most P0 and P1 items are S-M effort. The largest pieces are the platform decision with its migrations, storage and email alignment, and a real test/CI harness.

**What would a principal product and engineering team do next?**
1. Freeze feature work.
2. Execute Stage 0 within days, since most of it is deletions and one-line access fixes.
3. Make the HD-01 decision.
4. Stand up a staging environment that mirrors production.
5. Do not call anything "launch ready" until the golden path has been walked there on a production build.

This is the same conclusion the project's own August retrospective reached, and it was not acted on.

**Consequences of shipping as-is:**
- KIIT's official platform would present invented startups, invented mentors attributed to real companies, and fabricated success stories. The project's own documents identify this as the outcome most damaging to its credibility.
- Student emails would be exposed if any lab bookings exist.
- The CMS would run on versions with published critical access-control advisories.
- Applicants may be unable to verify email and therefore unable to submit.
- Nobody would know when it breaks.

**Shortest credible path to a high-quality finished product:** Stage 0, then Stage 1, then Stage 2, then the Stage 7 gate, then a controlled pilot with one real program and one real cohort. Stages 3-5 run in parallel where they don't touch the critical path. Defer everything in "do not build now".

---

## 21. HANDOFF PACKAGE FOR THE PROJECT OWNER

*(Self-contained; can be pasted into another conversation.)*

### A. Project fact sheet
| | |
|---|---|
| Product | KNEST: KIIT University's student entrepreneurship platform (public site + member area + staff console) |
| Purpose | Convert students into program applicants and founders; let staff run programs and content without developers; show outcomes honestly |
| Users | Students (exploring, idea-stage), founders, mentors, investors, partners, KNEST staff (reviewer, program/content/startup/mentor managers, super admin) |
| Stack | Next.js 16.3.3 (App Router), React 19, TypeScript strict, Payload CMS 3.88 (embedded, `cms` schema), Drizzle + Postgres 16 (`app` schema), Auth.js v5 beta (DB sessions), Tailwind v4, Framer Motion, nodemailer, AWS S3 SDK |
| Architecture | Single Next.js deployable; one Postgres with two schemas; guard module for authz; Payload staff auth bridged from Auth.js |
| Deployment status | UNVERIFIED. Docs say AWS ECS/RDS/S3/SES; config indicates Vercel; no staging run recorded |
| Integrations | SMTP (unset locally), S3 (credentials not wired), Google OAuth (optional, unset), no analytics or monitoring vendors |
| Core business logic | Rule-based recommender (role x stage); generic program question sets; application state machine draft -> submitted -> under_review -> shortlisted -> interview -> accepted/rejected/waitlisted; event registration with capacity |

### B. Verified current state
- **Implemented (code):** auth (signup, login, verify, reset, logout); onboarding; recommender; public content pages; apply/answer/upload/submit; staff review with audit and notifications; events registration; in-app and email notifications; rate limiting; file sniffing; CSP; funnel analytics; lab booking (out of scope).
- **Verified at runtime:** typecheck, 20 unit tests, production build; public shell renders; `/admin` 404 to anonymous users; 375 px layout without overflow.
- **Partially implemented:** onboarding to intent return; analytics; contact pathways; lab booking.
- **Missing:** `/profile`, `/privacy`, `/terms`, sitemap/robots, CI, monitoring, Payload migrations, `lab_admin` migration, staging.
- **Broken:** ESLint (crashes); fallback content (fabricated); Google button when unconfigured; blog card links; About anchors.
- **Unverified:** every DB-backed flow at runtime; production configuration; production data state.

### C. Critical findings (evidence pointers)
| ID | Finding | Evidence |
|---|---|---|
| KN-01 | Fabricated content | `src/server/content/{startups,programs,mentors,events,articles}.ts` (`FALLBACK_*`); runtime `/blog` |
| KN-02 | Public lab-booking PII | `src/payload/collections/lab-bookings.ts:12` |
| KN-03 | Vulnerable deps | `pnpm audit --prod` (Payload <3.90, Next <16.3.8) |
| KN-04 | No cms migrations; `lab_admin` missing migration | `src/payload/payload.config.ts:85-89`; `src/db/schema/enums.ts:36` |
| KN-05 | Email logs tokens / S3 credentials unwired / local media | `src/server/email/send.ts:25-29`; `src/server/storage/index.ts:17,28,47` |
| KN-33 | Never staged | `docs/PHASE-10-12-RETROSPECTIVE.md` section 9 |

### D. Delivery blockers
KN-01, KN-02, KN-03, KN-04, KN-33, and KN-05 once production configuration is confirmed. Decisions HD-01 to HD-07.

### E. Recommended improvement priorities
1. Stage 0 (delete fallbacks, lock lab bookings, upgrade deps, guard seeds, remove dev mocks).
2. Platform decision and migrations.
3. Email/storage wiring.
4. Journey fixes (`next`, onboarding result, Google guard, links, legal pages).
5. CI with migrate-from-zero, build and E2E.
6. Monitoring and backups.
7. Analytics redesign.
8. Accessibility and copy.

### F. Human questions
HD-01 to HD-07 are blocking: platform; content-honesty rule; lab booking; institutional copy approval; email/storage providers; privacy/legal owner; whether any DB was seeded with defaults.

HD-08 to HD-15 are non-blocking: blog, search, Google SSO, design-kit relocation, analytics vendor, `/profile`, contact pathway, newer brochure.

### G. Roadmap summary
0 Critical risks -> 1 Foundation & data integrity -> 2 Core journeys -> 3 Usability/a11y/copy -> 4 Analytics -> 5 Security/reliability/testing -> 6 Applicable enterprise capabilities -> 7 Staging validation gate -> 8 Controlled pilot.

### H. Reference index
| Topic | Location |
|---|---|
| Product contract | `docs/PRODUCT_ARCHITECTURE.md`, `docs/USER_JOURNEYS.md`, `docs/CONTENT_SPEC.md`, `docs/UX_WIREFRAMES.md` |
| Prior self-audits | `docs/PHASE-5-6-RETROSPECTIVE.md`, `docs/PHASE-7-9-RETROSPECTIVE.md`, `docs/PHASE-10-12-RETROSPECTIVE.md` |
| Auth | `src/server/auth/{config,session,guards,roles,tokens,actions}.ts`, `src/payload/auth-strategy.ts`, `src/payload/access.ts` |
| Application engine | `src/server/applications/*`, `src/app/api/applications/**`, `src/app/api/admin/applications/**` |
| Content layer (fallbacks) | `src/server/content/*.ts` |
| Lab booking | `src/server/actions/lab-booking.ts`, `src/payload/collections/lab-bookings.ts`, `src/app/(member)/dashboard/lab-booking/*` |
| Analytics | `src/server/analytics/{track,funnel}.ts`, `src/app/api/analytics/track/route.ts`, `src/app/(staff)/admin/analytics/page.tsx` |
| Infra / config | `next.config.ts`, `package.json`, `drizzle.config.ts`, `src/db/migrations/*`, `src/server/{email,storage}/*`, `src/db/client.ts` |
| Seeds | `src/db/seed.ts`, `seed-demo.ts`, `seed-dummy*.ts`, `patch_seed.mjs` |
| Tests | `src/server/{applications/transitions,auth/roles,onboarding/recommend}.test.ts` |
| Issue IDs | KN-01 to KN-34 (this document, section 15); HD-01 to HD-15 (section 19) |

### I. Continuation instructions
- **Must know:**
  - Production behaviour has never been verified on the real platform.
  - "Verified live" in older docs means verified against `next dev`.
  - The content-honesty rule is a founding product principle, not a style preference.
  - The `cms` schema has no migrations; Payload auto-pushes only outside production.
- **Do not change without approval:**
  - the two-schema split;
  - DB-session auth and the 404-for-non-staff rule;
  - the application state machine edges;
  - the deliberately-absent features list (ARCH section 7);
  - public copy and claims (HD-04);
  - lab-booking scope (HD-03).
- **Assumptions requiring confirmation:**
  - Vercel is the real target (HD-01).
  - No production DB has been seeded with defaults (HD-07).
  - DPDP applicability (HD-06).
  - The Payload 3.90 upgrade stays within Next 16's peer range (verify on upgrade).
- **Pending:** stakeholder feedback (Section 16).

---

### Audit quality checklist
- [x] Product goal reconstructed
- [x] Scope and non-scope distinguished
- [x] Docs vs implementation compared
- [x] Routes and features inventoried
- [x] Core workflows evaluated (source-level; runtime for the public shell)
- [x] Source vs runtime verification distinguished
- [x] Business rules reviewed
- [x] DB and integrations examined
- [x] Architecture and maintainability assessed
- [x] Security and privacy considered
- [x] Performance claims evidence-based (none invented; unmeasured items marked)
- [x] Analytics instrumentation evaluated
- [x] Dashboard correctness assessed
- [x] Testing quality examined
- [x] Ops readiness assessed
- [x] Enterprise capabilities classified for applicability
- [x] Stable IDs assigned
- [x] Blockers visible
- [x] Unknowns explicit
- [x] Human decisions isolated
- [x] Roadmap present
- [x] No implementation performed
- [x] No secret values or personal data reproduced
