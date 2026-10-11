# KNEST full release plan (all 53 modules, one finished push)

Date: 2026-10-12. Branch `codex/production-v1`. Basis: `LOCAL-COMPLETENESS.md`, `CONTRACT-TRACEABILITY.md`, `LAB-BOOKING-DESIGN.md`, `LAB-ATTENDANCE-THREAT-MODEL.md`, `DELIVERY-AUDIT-2026-10-12.md`, repo inspection and CI on `acf04c8`.

**How to read the percentages.** Each module percent is my judgement of how much of that module is built and proven against a real database in CI. It is not production-proven; nothing is. 100 means "nothing further to do before the AWS push", not "launched".

## 1. Decision recorded: build everything first, AWS last

- All remaining work happens locally and in CI. Nothing new is pushed to AWS until the finished release candidate passes the local gates in section 5.
- **Fact you should weigh:** a preview stack (CloudFront, WAF, load balancer, host, database) already exists and bills roughly USD 70 to 95 a month. Options: leave it idle (default, no action, covered by the account credit for now), or tear it down and recreate it at the end. Teardown destroys the database and the verified origin setup; I will not do it without an explicit instruction.
- **Three things local-only cannot prove**, so they are scheduled as the first hosted steps, not skipped: real S3, SES and Turnstile behaviour; real TLS and DNS; QR and camera on real phones (needs HTTPS; use a local HTTPS or tunnel setup for devices before AWS).

## 2. Stats

| Area | Modules | Avg built and CI-proven | What is missing |
|---|---|---|---|
| A. Foundation and accounts | 1 to 9 | 85% | Token lint, network-failure states, real mail proof |
| B. Content and public site | 10 to 20 | 85% | Homepage counters, approved copy (HD-04) |
| C. Applications, review, documents, analytics | 21 to 24, 33 to 35 | 83% | Real S3 proof, analytics sign-off |
| D. Lab platform (manual attendance) | 25 to 29, 32 | 80% | HD-16 policy values, assistant-visibility decision, real-user trial |
| E. QR pass, scan, PWA, offline, camera | 30, 31, 36, 37, 38 | 3% | Everything (design and threat model only) |
| F. Security | 39 to 43 | 79% | Real Turnstile, HSTS at edge, pen test |
| G. Hosting and operations | 44 to 49 | 50% | Everything proven on real infrastructure |
| H. Quality and handover | 50 to 53 | 59% | Manual accessibility, performance budget, training |

| Measure | Value |
|---|---|
| Average across all 53 modules | **about 70%** |
| Average across the 48 modules excluding QR, PWA and offline | **about 77%** |
| Modules at or above 85% | 24 of 53 |
| Modules at 0 to 10% | 5 (all in area E) |
| Delivery-ready (proven, operated, approved) | **about 45 to 50%** |

The gap between 70% built and about 50% delivery-ready is the unproven, unapproved and unoperated work.

## 3. Module-by-module plan

Phase codes: P1 close gaps, P2 labs, P3 attendance (QR, PWA, offline), P4 hardening, P5 release candidate, P6 AWS push.

### Area A: foundation and accounts

| # | Module | % | Remaining work | Done when | Phase |
|---|---|---|---|---|---|
| 1 | Project foundation | 90 | Dependency alert triage; pin and record upgrade policy | Zero untriaged alerts | P4 |
| 2 | Data architecture, two schemas | 95 | Final schema review before freeze | Reviewed and frozen | P5 |
| 3 | Migrations and seeds | 90 | Upgrade rehearsal on a populated database; seed docs | Rehearsal evidence recorded | P5 |
| 4 | Design system and tokens | 70 | Resolve the "pipeline" ambiguity (HD-22); hardcode lint at zero; clear 28 bypass warnings | Lint zero, tokens documented | P1 |
| 5 | Component library and shell | 85 | Manual keyboard and screen-reader pass; fix findings | Reviewer sign-off | P4 |
| 6 | Authentication and sessions | 90 | Enable Google sign-in with real credentials and test; per-account limits already built | Enabled-state test passes | P1 |
| 7 | Account lifecycle | 85 | Real SES verification and reset round-trip | Real mail delivered and parsed | P6 |
| 8 | Roles and authorisation | 90 | Decide and build assistant visibility (own duties only) | Matrix test updated | P2 |
| 9 | Account screens | 75 | Prove network-failure and slow-network behaviour in a browser | Journey tests added | P1 |

### Area B: content and public site

| # | Module | % | Remaining work | Done when | Phase |
|---|---|---|---|---|---|
| 10 | Payload staff console | 90 | Editor walkthrough with a real editor; confirm role limits | Staff sign-off | P5 |
| 11 | Programme and venture types | 95 | Real data entry trial | Trial passes | P5 |
| 12 | Editorial and site types | 90 | Media pipeline checks, homepage global | Checked | P5 |
| 13 | Content delivery layer | 90 | Error-state coverage on every public page | Gate test | P4 |
| 14 | Homepage | 60 | Triple-helix section, real counters that hide at zero, approved copy | HD-04 plus counters traced to tables | P1 |
| 15 | Programme pages | 90 | Final copy and filters review | Crawl clean | P5 |
| 16 | Ecosystem directories | 90 | Real profiles loaded | Crawl clean | P5 |
| 17 | Events and resources | 90 | Calendar export, past-event handling review | Tests | P1 |
| 18 | About, Ecosystem, Invest | 60 | Approved copy only (not engineering) | HD-04 evidence | P1 |
| 19 | Site-wide search | 90 | Ranking and stored-query retention decision (KN-29) | Tests | P4 |
| 20 | Onboarding and recommendation | 90 | Recommendation tuning with real programmes | Journey test | P5 |

### Area C: applications and operations

| # | Module | % | Remaining work | Done when | Phase |
|---|---|---|---|---|---|
| 21 | Application engine | 90 | Question-set editor review, large-form performance | Tests | P4 |
| 22 | Lifecycle and review states | 90 | Draft-on-view creation (KN-31), deadline handling | Tests | P1 |
| 23 | Member dashboard and events | 90 | Confirmation notification, mislabelled counts | Tests | P1 |
| 24 | Notification centre | 85 | Real email delivery, outbox operator resend view | Mail round-trip | P1 / P6 |
| 33 | Review console | 90 | Reviewer walkthrough, bulk actions if requested | Staff sign-off | P5 |
| 34 | Document handling | 70 | Real S3, upload failure modes, retention policy decision, orphan reconciliation live | Real-S3 test, retention approved | P6 |
| 35 | Analytics dashboard | 65 | Table-derived funnel complete, retention of raw search text | Reconciliation test | P1 |

### Area D: lab platform (manual attendance)

| # | Module | % | Remaining work | Done when | Phase |
|---|---|---|---|---|---|
| 25 | Lab registry | 80 | Real lab data, HD-16 policy values | Heads sign off | P2 |
| 26 | Availability and slot engine | 80 | Timezone and DST edge tests, holiday calendar | Tests | P2 |
| 27 | Booking request flow | 80 | Limits per policy, mobile UX pass | Journey | P2 |
| 28 | Lab-head console | 80 | Head walkthrough, escalation when a head is absent | Staff sign-off | P2 |
| 29 | Assistant roster | 75 | Visibility rule, duty swap, absence | Authz tests | P2 |
| 32 | Utilisation reporting | 85 | Department hierarchy values, export review | Reconciliation | P2 |

### Area E: QR pass, scan, PWA, offline (blocked by decisions, then build)

| # | Module | % | Remaining work | Done when | Phase |
|---|---|---|---|---|---|
| 30 | Signed QR pass | 5 | Decide assurance level (records attendance vs opens a door); P-256 key enrolment, non-extractable keys, pass signing, 30 s rotation, revocation | Forgery, replay, screenshot tests | P3 |
| 31 | Two-sided check-in and out | 3 | Dual-signature exchange, server decision, partial and manual states, audit | Tests plus Android and iOS runs | P3 |
| 36 | PWA packaging | 0 | Manifest, icons, install flows on both platforms | Installs on real devices | P3 |
| 37 | Offline shell and sync | 2 | Service worker, bounded 24 h roster cache, queue, idempotent sync, conflict and clock-skew handling, iOS storage eviction fallback | Offline matrix passes | P3 |
| 38 | Camera scanning | 3 | In-browser decoding with fallback, low-light and manual entry, accessibility path | Device matrix | P3 |

### Area F: security

| # | Module | % | Remaining work | Done when | Phase |
|---|---|---|---|---|---|
| 39 | Turnstile | 80 | Real keys, failure-mode handling when Cloudflare is unreachable | Real-key test | P6 |
| 40 | Rate limiting | 85 | Edge and WAF rule tuning, load behaviour | Load test | P4 |
| 41 | Browser hardening | 75 | CSP report-only period, HSTS at edge, strictness review | Header test on real edge | P6 |
| 42 | Upload safety | 85 | Antivirus decision (institutional), download policy | Decision recorded | P4 |
| 43 | Secrets, encryption, audit | 70 | Scoped IAM, rotation drill, audit of privileged actions complete, penetration test | Drill and pen test report | P4 / P6 |

### Area G: hosting and operations (proven only at the end)

| # | Module | % | Remaining work | Done when | Phase |
|---|---|---|---|---|---|
| 44 | Hosting | 55 | Record HD-22 (EC2 plus CloudFront instead of Amplify); rolling deploy; Multi-AZ decision; staging | Variation signed | P6 |
| 45 | RDS | 60 | Runtime role live, timed restore, point-in-time recovery drill | Drill evidence | P6 |
| 46 | S3 and CloudFront | 55 | Lifecycle rules, signed access, real upload and download | Staging proof | P6 |
| 47 | SES | 40 | Verify domain, production access, DMARC pass, bounce handling | DMARC pass, real mail | P6 |
| 48 | Edge | 50 | Route 53 delegation, aliases, WAF rule review, DDoS posture | Four hostnames verified | P6 |
| 49 | Monitoring | 40 | Dashboards, external uptime probe, confirmed recipients, alarm drill | Alarm reaches a person | P6 |

### Area H: quality and handover

| # | Module | % | Remaining work | Done when | Phase |
|---|---|---|---|---|---|
| 50 | Accessibility | 55 | Manual screen-reader and keyboard walk with a reviewer, fixes, statement | Audit report | P4 |
| 51 | Automated tests | 75 | Load tests, flag-off and flag-on runs, device suite for QR, coverage measurement | Targets met | P4 / P5 |
| 52 | Performance and visibility | 45 | Image pipeline, social cards, Lighthouse budget in CI | Budget green | P4 |
| 53 | Documentation and training | 60 | Reconcile stale docs, training sessions for staff and lab heads | Sign-off | P5 |

## 4. Phases

| Phase | Purpose | Exit gate |
|---|---|---|
| P0 Decisions | Finish line, contract reconciliation, HD-16 lab policy, QR assurance level, device matrix, retention, antivirus, HD-04 and HD-06 owners | Written decisions on file |
| P1 Close V1 gaps | Modules 4, 6, 9, 14, 17, 18, 22 to 24, 35 | Each at 90% or above, CI green |
| P2 Labs to production quality | Modules 25 to 29, 32, 8 | Lab heads accept in a supervised trial |
| P3 Attendance, PWA, offline | Modules 30, 31, 36 to 38 | Threat model signed off, device matrix passes |
| P4 Hardening | Dependencies, load, accessibility, performance, security review | Reports on file, no open critical or high |
| P5 Release candidate | Everything on, populated-database upgrade rehearsal, docs, training | One SHA passes every local gate |
| P6 AWS push | Apply stacks, real providers, drills, cutover, verification | Evidence file per gate |
| P7 Hypercare | Support window and maintenance | Handover accepted |

## 5. Local release-candidate gates (before any AWS push)

1. Lint, typecheck, unit, integration and image build green in CI on the exact SHA.
2. All feature flags on in one run, and also with labs off.
3. Populated-database upgrade rehearsed from the previous schema.
4. Zero serious or critical automated accessibility findings, plus the manual pass report.
5. Load test at an agreed concurrency on a production-like container.
6. QR, camera, PWA and offline pass the real-device matrix on Android and iOS.
7. Dependency alerts triaged; penetration test findings closed.
8. Docs and training complete; approvals (HD-04, HD-06, HD-16) recorded.

## 6. Effort (judgement, person-days)

| Block | Likely | Range |
|---|---|---|
| P1 close V1 gaps | 12 | 9 to 18 |
| P2 labs to production quality | 10 | 8 to 15 |
| P3 QR, PWA, offline, camera | 30 | 20 to 45 |
| P4 hardening | 12 | 9 to 18 |
| P5 release candidate and training | 6 | 4 to 10 |
| P6 AWS push and drills | 12 | 8 to 20 |
| **Total** | **about 82** | **about 58 to 126** |

Calendar for two engineers: about 9 to 12 weeks likely, 7 to 18 weeks range, plus approvals. One engineer: about 17 to 22 weeks. QR work cannot start until the assurance-level decision and the threat-model sign-off; it is the largest uncertainty.

## 7. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Big-bang release | One failure delays everything | Keep flags; ship dark behind flags if any block slips |
| QR assurance level undecided | Wrong design cost | Decide in P0 |
| iOS PWA limits (storage eviction, no background sync) | Offline promise weaker than contract wording | Document the contract-wording variation; manual fallback |
| Late hosted contact | Surprises in S3, SES, DNS at the end | Schedule real-provider checks first in P6 |
| Approvals not arriving | Launch blocked regardless of code | Name owners and dates in P0 |
| Preview stack billing while idle | USD 70 to 95 a month | Decide leave or tear down |
