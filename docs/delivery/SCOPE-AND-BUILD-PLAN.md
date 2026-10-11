# KNEST: full scope and build plan

Date: 2026-10-12. Branch `codex/production-v1`. Sources: `LOCAL-COMPLETENESS.md` (53 contract modules), `TRACKER.md`, `docs/audit/08-prioritized-backlog.md`, `V1-DEPLOYMENT-REPORT.md`, `ROLLOUT-PLAN-AND-BILLING.md`, `OPERATOR-COMMANDS.md`.

Status words: DONE (built, tested), PARTIAL (built, named gaps), TODO (buildable now), GATED (waits on a person or approval), DEPLOY (needs the AWS or DNS step).

## 1. In scope for V1 (applications platform)

| Area | Modules | State |
|---|---|---|
| Foundation, data, migrations, design system, shell | 1 to 5 | DONE (4 PARTIAL: hardcode lint) |
| Auth, sessions, account lifecycle, roles | 6 to 9 | DONE; 8 has one open decision (assistant visibility), 9 needs network-failure proof |
| CMS staff console, content types, delivery layer | 10 to 13 | DONE |
| Public site: homepage, programs, directories, events, resources, search, onboarding | 14 to 20 | DONE except homepage counters and About/Ecosystem/Invest copy (HD-04) |
| Application engine, review, dashboard, notifications, documents | 21 to 24, 33, 34 | DONE |
| Analytics dashboard | 35 | PARTIAL: reconcile against table figures |
| Security: Turnstile, rate limits, browser hardening, uploads, audit | 39 to 43 | 40 now closed for staff and lab routes (this commit); 41 HSTS at CloudFront; 43 CMS publish audit open |
| Hosting, database, storage, mail, edge, monitoring | 44 to 49 | DEPLOY: preview live; runtime role, mail outbox, SES, budget built |
| Accessibility, tests, performance, handover docs | 50 to 53 | PARTIAL: manual screen-reader walk, Lighthouse budget, social cards, handover docs |

## 2. Out of V1 (built or designed, switched off)

Lab booking (modules 25 to 29, 32) is built behind `FEATURE_LAB_BOOKING=false` and waits on HD-16. QR pass, two-sided scan, PWA, offline sync, camera scanning (30, 31, 36 to 38) are GATED by the threat-model review and device tests. Permanent staging environment is not part of V1.

## 3. Build queue (buildable without AWS)

| # | Item | Module | Status |
|---|---|---|---|
| 1 | Rate limits on admin and lab mutation routes, lab availability | 40 | DONE in this commit; integration coverage runs in CI |
| 2 | Per-account sign-in throttle (not only per address) | 40 | TODO |
| 3 | Audit rows for CMS publish and unpublish actions | 43 | TODO |
| 4 | Analytics reconciliation test; homepage counters read tables, hide at zero | 35, 14 | TODO |
| 5 | Social cards, image pipeline, Lighthouse budget in CI | 52 | TODO |
| 6 | Hardcode lint for tokens | 4 | TODO |
| 7 | Network-failure behaviour on account screens | 9 | TODO |
| 8 | Handover docs: architecture, content editing guide, staff walkthrough | 53 | TODO |
| 9 | Decide lab assistant visibility (own duties only, per design) | 8 | decision, then build |

## 4. Deploy queue (needs AWS sign-in, then people)

1. Re-authenticate AWS (root session expired).
2. Re-apply app stack change set (`UpdateMethod: NewVersion`), redeploy new digests, read the unread deploy result `8cd6b03e...`.
3. Hosted smoke test, preview verification, confirm SNS alert subscription.
4. GoDaddy records (ACM validation, SES DKIM) with the emailed one-time code.
5. Real Turnstile keys, then Route 53 zone, DNS comparison, aliases.
6. Cutover preflight, nameserver change, gate removal, four-hostname verification.

## 5. Gates that people own

| Gate | Owner | Note |
|---|---|---|
| HD-06 privacy, terms, content approval evidence | KIIT approver | The pages honestly say "being finalised" until text is supplied |
| HD-04 copy for About, Ecosystem, Invest, homepage | KIIT | Not an engineering task |
| HD-16 lab policy | Lab heads | Only for lab booking |
| Billing and alert owner (institutional mailbox) | Institution | Interim: pinakipattnaik@gmail.com |
| Commercial document (contract) reconciliation | Owner | Contract status UNVERIFIED until supplied |

## 6. Done means

Each build item ships with a unit or integration test, passes `pnpm lint`, `pnpm typecheck`, `pnpm test` locally and the full CI pipeline on the pushed SHA. Deploy items finish with a dated record in `EVIDENCE/`.
