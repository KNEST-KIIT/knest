# Local completeness: every contracted module, as of 2026-10-09

**Purpose:** the owner asked to finish and prove everything locally before any deployment. This tracks the 53 contract modules (`CONTRACT-TRACEABILITY.md` wording) against the code **now**. It replaces the baseline statuses in that file, which pre-date Phase 1.

**Status words.** `DONE` = built and covered by tests that pass on the production build against a real database (local). `PARTIAL` = built, with named gaps. `TODO` = not built, buildable locally. `GATED` = not built on purpose: waiting for a decision, approval or test that only people can supply. `IAC` = infrastructure written as templates, tested for structure, **not deployed**. `DONE` never means verified in staging or production; neither exists yet.

## Foundation and accounts

| # | Module | Status | Notes |
|---|---|---|---|
| 1 | Project foundation | DONE | Next 16, strict TypeScript, lint, typecheck, unit, integration, secret scan, image build in CI. |
| 2 | Data architecture (two schemas) | PARTIAL | Everything operational is in `app` **except lab bookings**, which still sit in the CMS. Moves with the lab build. |
| 3 | Migrations and seeds | DONE | Drizzle 0000-0009, Payload baseline + media; migrate-from-zero and drift checks; seeds refuse production. |
| 4 | Design system and token pipeline | PARTIAL | Tokens in CSS; "pipeline" wording is ambiguous (HD-22). Hardcode lint to add. |
| 5 | Component library and shell | PARTIAL | Primitives and pagination exist; accessibility audit (axe, keyboard) not yet run across them. |
| 6 | Authentication and sessions | DONE | Revocable DB sessions, deactivation ends sessions, role changes revoke, Turnstile, rate limits, hashed tokens. Google sign-in guarded when not configured. |
| 7 | Account lifecycle | DONE | Verification and reset: hashed single-use tokens, atomic consume, e-mail via SES path (stub-tested). |
| 8 | Roles and authorisation | PARTIAL | Staff roles and areas tested for every role; **lab head / assistant scoping arrives with the lab build.** |
| 9 | Account screens | PARTIAL | Six screens exist; network-failure behaviour to be proven in the browser pass. |

## Content and public site

| # | Module | Status | Notes |
|---|---|---|---|
| 10 | Payload CMS staff console | DONE | Upgraded, locked, role-tested. |
| 11, 12 | Content types, editorial types, media | DONE | Media now in S3 (plugin, migration). |
| 13 | Content delivery layer | DONE | Honest empty and error states; no invented content (gate test). |
| 14 | Homepage | PARTIAL | Real data only. Triple-helix section and live counters need approved copy (HD-04) and a decision on which numbers are shown; counters will read the tables and hide at zero. |
| 15, 16 | Programme pages, directories | DONE | Covered by the dead-link crawl and render tests. |
| 17 | Events, resources, articles | DONE | Article detail pages added; blog links fixed. |
| 18 | About, Ecosystem, Invest | PARTIAL | Pages render; **copy needs HD-04 approval** (not an engineering task). |
| 19 | Site-wide search | DONE | Programs, startups, mentors, events, resources; drafts excluded. |
| 20 | Onboarding and recommendation | DONE | Return path survives sign-up; recommendation covered. |

## Application engine, dashboard, staff review

| # | Module | Status | Notes |
|---|---|---|---|
| 21 | Application engine | DONE | Question snapshot at submit; program delete guard. |
| 22 | Lifecycle and review states | DONE | Locked writes, conditional transitions, server validation, audit rows. |
| 23 | Member dashboard and events | DONE | Capacity under parallel load, past events refused, confirmation sent once. |
| 24 | Notification centre | PARTIAL | Applications and events done; **booking notifications arrive with the lab build.** |
| 33 | Application review console | DONE | Queue with search, filters, paging; detail; decisions; audit trail viewer; enquiries inbox; members screen; overview. |
| 34 | Document handling | DONE (local) | Real multipart upload, type sniffing, size limit at the byte, access control; S3 stub-tested. Real S3 is proven in S-1. |
| 35 | Analytics dashboard | PARTIAL | Funnel counts exist; reconcile against table-derived figures and add a test. |

## Lab platform

| # | Module | Status | Notes |
|---|---|---|---|
| 25 to 29 | Lab registry, slot engine, request flow, head console, assistant roster | TODO (design done) | `LAB-BOOKING-DESIGN.md`. Behind a flag, policy as settings, **not enabled until HD-16**. |
| 32 | Utilisation reporting | TODO | With the lab build, from the tables. |
| 30, 31, 36, 37, 38 | Signed QR pass, two-sided scan, PWA, offline sync, camera scanning | GATED | Threat-model review, real-device tests and lab-head review first. Manual attendance is built instead and labelled as such. |

## Security, operations, hosting

| # | Module | Status | Notes |
|---|---|---|---|
| 39 | Cloudflare Turnstile | DONE | Sign-up, sign-in, reset, application submit, contact; booking request joins with the lab build. |
| 40 | Rate limiting | DONE | Every sensitive endpoint, database-backed; client address from CloudFront in production. |
| 41 | Browser hardening | PARTIAL | CSP, frame, sniffing, referrer, no-store set by the app; HSTS is set at CloudFront (IAC). |
| 42 | Upload safety | DONE | No script-capable types; verified by content. |
| 43 | Secrets, encryption, audit | PARTIAL | Audit rows for review, submit, members, enquiries; CMS publish actions not yet audited. Encryption and secrets are IAC. |
| 44 to 49 | Hosting, database, storage, mail, edge, monitoring | IAC | AWS-native templates, tests, runbooks. Amplify is replaced by EC2 + CloudFront (Next 16 is not supported by Amplify): recorded as a variation to the owner (HD-22). |

## Quality and handover

| # | Module | Status | Notes |
|---|---|---|---|
| 50 | Accessibility | TODO | Automated axe pass over every public, member and staff screen; fix findings; keyboard and reduced-motion checks. |
| 51 | Automated tests | PARTIAL | 318 unit and about 170 integration tests; real-browser journeys for student and staff still to add; booking flows with the lab build. |
| 52 | Performance and search visibility | PARTIAL | Sitemap, robots, noindex-until-launch done; image pipeline, social cards and a Lighthouse budget to add. |
| 53 | Documentation, training, handover | TODO | Architecture, content-editing guide, lab operations guide, staff walkthrough. |

## Order of remaining local work

1. Lab booking core (modules 2, 8, 24, 25 to 29, 32, 39 for bookings), behind the flag.
2. Accessibility pass (50) with fixes; browser journeys for student and staff (51).
3. Analytics reconciliation (35); homepage counters from real tables (14); images and social cards (52); audit coverage for CMS actions (43).
4. Handover documentation (53).
5. A final full run on a clean database, recorded as evidence.

## What is not engineering

Copy approval (HD-04), the privacy and terms text (HD-06), the lab operating policy (HD-16), the QR gates, the contract record and variation (HD-21, HD-22), and everything on AWS and DNS.
