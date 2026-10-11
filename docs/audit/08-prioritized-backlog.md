# Deduplicated prioritized backlog
Person-days include implementation, review and focused regression tests unless noted. Low/likely/high assume repository-familiar engineers and timely approved inputs. Owner/provider waiting is additional. Nothing here authorizes implementation.

P0 = release blocker/gate, not a currently exploited production incident. P1 = required for selected V1; P2 = valuable after V1; P3 = optional. Lab work is conditional. Canonical findings: F04/F09/F17/F18/F19/F20/F23 in report 03; F11–F16 in 04; F01/F02/F05/F21/F22 in 05; F03/F06/F07/F08/F10/F24 in 06.

| Task | Category | Priority | Finding IDs | Owner | Low / likely / high person-days |
|---|---|---|---|---|---|
| B01 Approve the release boundary and institutional inputs | Product | P0 release gate | F04,F18,F19,F24 | Product owner + product/engineering lead | 1 / 2 / 4 |
| B02 Secure Server Actions, ownership and returned data | Security/backend | P0 release blocker | F01,F14 | Backend engineer + security reviewer | 3 / 5 / 9 |
| B03 Enforce secure production environment and trusted edge identity | Security/operations | P1 required for V1 | F05,F21 | Backend/security + SRE | 1 / 2 / 3 |
| B04 Make reset/token/admin invariants atomic | Backend/data | P1 required for V1 | F11 | Backend/data engineer | 1 / 2 / 4 |
| B05 Validate document question and bound stored-file lifecycle | Backend/data/security | P1 required for V1 | F12,F04 | Backend + storage/security | 1 / 2 / 4 |
| B06 Persist notification delivery and truthful post-commit results | Backend/reliability | P1 required for V1 | F13 | Backend + SRE | 2 / 3 / 5 |
| B07 Repair core form recovery, return paths and dangerous controls | Frontend/product | P1 required for V1 | F09 | Frontend engineer | 2 / 4 / 6 |
| B08 Accept keyboard, screen-reader and dynamic mobile states | Frontend/accessibility | P1 required for V1 | F17,F23 | Frontend + accessibility reviewer | 1 / 2 / 4 |
| B09 Complete origin TLS and runtime database identity | Operations/security | P0 TLS blocker; P1 identity work | F03,F06 | SRE + data/security engineer | 2 / 4 / 7 |
| B10 Provision privately and verify real storage, mail, CAPTCHA and domain | Operations/integrations | P1 required for V1 | F24,F04,F03,F10 | SRE + institution domain/mail operator | 2 / 4 / 7 |
| B11 Gate exact release artifacts and rehearse migration recovery | Release/data/operations | P1 work; P0 recovery acceptance gate | F07,F08,F21 | Release/SRE + data engineer | 2 / 4 / 7 |
| B12 Establish user-facing monitoring, retention, cost and incident ownership | Operations | P1 required for V1 | F10,F04,F13,F22 | SRE + support/privacy owners | 2 / 3 / 5 |
| B13 Close risk test gaps and accept the exact hosted candidate | QA/release | P1 required for V1 | F21,F01,F17,F23,F24 | QA lead + each implementation owner | 3 / 5 / 8 |
| B14 Reconcile evidence, train operators and execute approved release checklist | Product/operations/documentation | P1 required for V1 | F18,F04,F10,F24 | Engineering lead + product/staff operators | 1 / 2 / 3 |

## Bounded task definitions

### B01 — Approve the release boundary and institutional inputs
**Why/evidence:** F04,F18,F19,F24; see canonical source/impact/reproduction in linked reports. **Category/priority:** Product; P0 release gate. **Scope/approach:** Retrieve received agreement privately, reconcile latest decisions, approve application V1 versus labs/QR variation, name copy/privacy/support/cloud/billing owners; integrate approved collection text.

**Affected modules:** delivery decisions/requirements; legal/content collection points. **Owner:** Product owner + product/engineering lead. **Dependencies/parallelism:** None; runs alongside B02–B08/B09 design.

**Acceptance/verification:** Versioned scope, signed required variations and HD-04/06 acceptance; no placeholders in collection/support; trace requirements to evidence.

**Estimate:** 1 / 2 / 4 person-days. **Confidence/assumptions:** Medium effort; high need; familiarity and no new features beyond approved scope. **Risks/unknowns:** Institutional/legal/commercial lead time not in person-days; mentor/profile or QR inclusion expands scope.

### B02 — Secure Server Actions, ownership and returned data
**Why/evidence:** F01,F14; see canonical source/impact/reproduction in linked reports. **Category/priority:** Security/backend; P0 release blocker. **Scope/approach:** Choose explicit API/action boundary; move internal readers to server-only DAL; derive session identity; assess actual page mutations individually; whitelist DTOs; exclude drafts from staff reads. F02 auth bypass was withdrawn and its optional hardening is B22.

**Affected modules:** applications/auth/events/notifications/onboarding use-server modules; review/download routes. **Owner:** Backend engineer + security reviewer. **Dependencies/parallelism:** No B01 wait for technical repair; B13 verifies exact candidate.

**Acceptance/verification:** Anonymous/cross-user raw action calls denied; each actual mutation has intended abuse controls; owners/reviewers retain intended access; no hashes/private notes in inappropriate payloads. API-route-only registrations are distinguished from callable page workers.

**Estimate:** 3 / 5 / 9 person-days. **Confidence/assumptions:** High findings; medium effort; familiarity and no new features beyond approved scope. **Risks/unknowns:** Enumerate every registered action, not only audit samples; downstream UI/API contracts must stay compatible.

### B03 — Enforce secure production environment and trusted edge identity
**Why/evidence:** F05,F21; see canonical source/impact/reproduction in linked reports. **Category/priority:** Security/operations; P1 required for V1. **Scope/approach:** Require correct HTTPS/cookie/DB CA/origin secret for AWS production; explicit safe synthetic exception; trusted forwarded-header assertions and per-account/mailbox rules.

**Affected modules:** env/instrumentation/session/client-ip/edge-guard; CI image fixture. **Owner:** Backend/security + SRE. **Dependencies/parallelism:** B09 chosen TLS topology; local assertions can start immediately.

**Acceptance/verification:** Unsafe/missing config refuses to serve; trusted edge works; direct-origin/spoofed-header requests denied; secure cookie verified through actual edge.

**Estimate:** 1 / 2 / 3 person-days. **Confidence/assumptions:** High need; medium integration effort; familiarity and no new features beyond approved scope. **Risks/unknowns:** Do not break deliberate loopback tests or health probe; correct template currently sets many safe values.

### B04 — Make reset/token/admin invariants atomic
**Why/evidence:** F11; see canonical source/impact/reproduction in linked reports. **Category/priority:** Backend/data; P1 required for V1. **Scope/approach:** Atomic consume/hash update/session revocation; serialized issuance where newest-only required; transaction/shared lock for last-active-superadmin rule.

**Affected modules:** auth/actions/tokens; members/actions. **Owner:** Backend/data engineer. **Dependencies/parallelism:** Independent of frontend/cloud; B02 boundary contracts.

**Acceptance/verification:** Injected failure rolls back reset; prior sessions revoked; coordinated two-admin race cannot remove last active admin; parallel token issuance semantics documented/tested.

**Estimate:** 1 / 2 / 4 person-days. **Confidence/assumptions:** High static; medium effort; familiarity and no new features beyond approved scope. **Risks/unknowns:** Hash outside transaction; avoid lock-order deadlocks and unapproved token-policy change.

### B05 — Validate document question and bound stored-file lifecycle
**Why/evidence:** F12,F04; see canonical source/impact/reproduction in linked reports. **Category/priority:** Backend/data/security; P1 required for V1. **Scope/approach:** Authorize/limit before expensive parse; validate current file question/actual bytes; compensate failed/replaced objects or reconcile under approved retention; choose institutional download-malware policy.

**Affected modules:** application document route/actions; storage adapter; retention tooling. **Owner:** Backend + storage/security. **Dependencies/parallelism:** B01 retention input; independent membership fix starts now; B10 real storage proof.

**Acceptance/verification:** Unknown/non-file question refused; size/type/ownership/status enforced on every callable path; replacement/race objects accounted for; synthetic lifecycle test/dry-run passes.

**Estimate:** 1 / 2 / 4 person-days. **Confidence/assumptions:** High findings; medium estimate; familiarity and no new features beyond approved scope. **Risks/unknowns:** Persistent old orphan counts unknown; no deletion without approved policy.

### B06 — Persist notification delivery and truthful post-commit results
**Why/evidence:** F13; see canonical source/impact/reproduction in linked reports. **Category/priority:** Backend/reliability; P1 required for V1. **Scope/approach:** Minimal DB delivery outbox/status/retry; idempotent attempts, bounded backoff/operator resend; event notice in domain transaction; handle lookup failure without false domain failure.

**Affected modules:** notifications/send; application/review/events transactions; delivery table/job. **Owner:** Backend + SRE. **Dependencies/parallelism:** B02 endpoints; B10 mail integration; B12 scheduler/alerts.

**Acceptance/verification:** Crash/send/lookup failure preserves domain+in-app record and retries mail; no duplicate notices; committed success remains truthful; failure visible to operator.

**Estimate:** 2 / 3 / 5 person-days. **Confidence/assumptions:** High gap; medium effort; familiarity and no new features beyond approved scope. **Risks/unknowns:** Avoid dedicated queue infrastructure unless evidence changes; mail provider limits/invalid addresses need terminal disposition.

### B07 — Repair core form recovery, return paths and dangerous controls
**Why/evidence:** F09; see canonical source/impact/reproduction in linked reports. **Category/priority:** Frontend/product; P1 required for V1. **Scope/approach:** try/catch/finally and retained input/retry; safe next across auth detours; status-aware resend; real contact links; remove unsupported Notify me; explicit confirmed role/deactivate actions.

**Affected modules:** login/signup/reset/verify; apply form; CTA/contact links; members controls. **Owner:** Frontend engineer. **Dependencies/parallelism:** Parallel B02/B04; stable contracts before final B13.

**Acceptance/verification:** Offline/aborted/429/500 requests recover without data loss or duplicate submit; full auth return matrix; internal fragments valid; role selection alone sends no mutation.

**Estimate:** 2 / 4 / 6 person-days. **Confidence/assumptions:** High source; medium effort; familiarity and no new features beyond approved scope. **Risks/unknowns:** Autosave timing and ambiguous response need idempotent retry; avoid adding subscription scope.

### B08 — Accept keyboard, screen-reader and dynamic mobile states
**Why/evidence:** F17,F23; see canonical source/impact/reproduction in linked reports. **Category/priority:** Frontend/accessibility; P1 required for V1. **Scope/approach:** Accessible menu focus/background/resize behavior; native semantics/real labels/field errors; focus/live feedback; manually walk mandatory states and zoom.

**Affected modules:** site-header; option-list; application field groups/upload; step focus. **Owner:** Frontend + accessibility reviewer. **Dependencies/parallelism:** B07 shared controls; approved content before final acceptance.

**Acceptance/verification:** Keyboard/NVDA/mobile/zoom mandatory journeys pass; no focus behind overlay; dynamic axe has no serious/critical; result and error announced.

**Estimate:** 1 / 2 / 4 person-days. **Confidence/assumptions:** Medium effort; high gaps; familiarity and no new features beyond approved scope. **Risks/unknowns:** Automated scans cannot substitute human acceptance; shared fixes reduce overlap with B07.

### B09 — Complete origin TLS and runtime database identity
**Why/evidence:** F03,F06; see canonical source/impact/reproduction in linked reports. **Category/priority:** Operations/security; P0 TLS blocker; P1 identity work. **Scope/approach:** Prove host TLS+renewal or add ALB/regional ACM; SG/health forwarding; runtime DML principal distinct from migrator; credential refresh/rotation.

**Affected modules:** app/edge/cert IaC; DB principal/secret/deploy wiring. **Owner:** SRE + data/security engineer. **Dependencies/parallelism:** B01 scoped identity/spend; design can proceed read-only; provider work after separate authorization.

**Acceptance/verification:** End-to-end origin TLS/cert valid; direct-origin denied; runtime cannot DDL; controlled rotation reconnects; costed chosen topology approved.

**Estimate:** 2 / 4 / 7 person-days. **Confidence/assumptions:** Medium/high technical; medium effort; familiarity and no new features beyond approved scope. **Risks/unknowns:** ALB regional certificate/IPv4/LCU costs; Payload schema permissions; no current AWS access proof.

### B10 — Provision privately and verify real storage, mail, CAPTCHA and domain
**Why/evidence:** F24,F04,F03,F10; see canonical source/impact/reproduction in linked reports. **Category/priority:** Operations/integrations; P1 required for V1. **Scope/approach:** Approved S-1/private production only; measure memory/CPU/pools; validate instance-role S3, RDS CA, real Turnstile, SES identity/access/DKIM/SPF/DMARC/delivery; preserve full DNS/mail record set.

**Affected modules:** AWS stack/ECR/SSM; RDS/S3/SES/Turnstile; DNS manifest. **Owner:** SRE + institution domain/mail operator. **Dependencies/parallelism:** B01 identity/budget/domain control; B09 TLS; B02 secure candidate.

**Acceptance/verification:** Synthetic full hosted journey with real providers; arm64 digest and sizing recorded; no real data before policy gate; validated cutover/rollback manifest.

**Estimate:** 2 / 4 / 7 person-days. **Confidence/assumptions:** Medium effort; access uncertainty high; familiarity and no new features beyond approved scope. **Risks/unknowns:** SES/registrar/identity lead time; existing account resources unknown; no permanent staging per owner.

### B11 — Gate exact release artifacts and rehearse migration recovery
**Why/evidence:** F07,F08,F21; see canonical source/impact/reproduction in linked reports. **Category/priority:** Release/data/operations; P1 work; P0 recovery acceptance gate. **Scope/approach:** Exact-SHA CI/scan gate and approved Environment; migrate empty and populated; snapshot/retention; old/new compatibility; restore new DB and reconnect; explicit maintenance deploy/digest rollback.

**Affected modules:** release-image workflow; ECR/SSM; migrations; restore runbook. **Owner:** Release/SRE + data engineer. **Dependencies/parallelism:** B09/B10 environment; B13 candidate checks; populated data authorized copy.

**Acceptance/verification:** Unverified SHA/scan disposition blocks promotion; failed replacement and incompatible migration exercises recover; both schemas/files consistent; measured RPO/RTO accepted.

**Estimate:** 2 / 4 / 7 person-days. **Confidence/assumptions:** High gaps; medium effort; familiarity and no new features beyond approved scope. **Risks/unknowns:** Snapshot exists already, do not rebuild it; master restore/endpoint behavior and historical CMS bookings unknown.

### B12 — Establish user-facing monitoring, retention, cost and incident ownership
**Why/evidence:** F10,F04,F13,F22; see canonical source/impact/reproduction in linked reports. **Category/priority:** Operations; P1 required for V1. **Scope/approach:** Critical HTTPS/journey and app/mail alarms, confirmed recipients/escalation, billing alerts, log redaction, privileged CMS audit, bounded snapshot/session/token/rate/analytics retention to approved policy.

**Affected modules:** CloudWatch/external health/logs/budget/audit/retention jobs/runbook. **Owner:** SRE + support/privacy owners. **Dependencies/parallelism:** B01 owners/policy; B10 hosted endpoint; B06 delivery state.

**Acceptance/verification:** Controlled alarm reaches responder; failure/recovery drill recorded; cost alert ownership confirmed; selective synthetic retention dry-run and privileged audit coverage accepted.

**Estimate:** 2 / 3 / 5 person-days. **Confidence/assumptions:** Medium; familiarity and no new features beyond approved scope. **Risks/unknowns:** Budget is not hard cap; don't add noisy every-minute business writes; audit privacy/retention decisions may alter effort.

### B13 — Close risk test gaps and accept the exact hosted candidate
**Why/evidence:** F21,F01,F17,F23,F24; see canonical source/impact/reproduction in linked reports. **Category/priority:** QA/release; P1 required for V1. **Scope/approach:** Fix silent drift status/test env escape and current selector/shared-fixture failures; exact committed candidate run; raw action negative suite; flag-off route/UI/no-write matrix; network/provider error tests; zero unhandled browser errors; bounded load/performance and manual acceptance.

**Affected modules:** integration setup/drift/flag suites; browser journeys; acceptance evidence. **Owner:** QA lead + each implementation owner. **Dependencies/parallelism:** B02–B12 integrated; test fixture work and planning early.

**Acceptance/verification:** All gates in07 name passing evidence/digest; expected-fail separately resolved/accepted; hosted real-provider and recovery evidence linked; critical regressions cannot silently pass.

**Estimate:** 3 / 5 / 8 person-days. **Confidence/assumptions:** Medium; familiarity and no new features beyond approved scope. **Risks/unknowns:** Estimate excludes regression-writing already owned by B02–B08; this task is harness + integration/final acceptance.

### B14 — Reconcile evidence, train operators and execute approved release checklist
**Why/evidence:** F18,F04,F10,F24; see canonical source/impact/reproduction in linked reports. **Category/priority:** Product/operations/documentation; P1 required for V1. **Scope/approach:** One current evidence-linked record; update truthful status/config/runbook; staff publishes/reviews/handles enquiries in witnessed training; owner accepts private candidate; cutover only later authorized.

**Affected modules:** README/current state/tracker/handover; final release manifest. **Owner:** Engineering lead + product/staff operators. **Dependencies/parallelism:** B01 approved scope; B11–B13 accepted; public action needs separate owner authorization.

**Acceptance/verification:** Staff can operate without engineer; no stale release claims/placeholders; all gates signed/evidenced, rollback/support available; public release decision recorded.

**Estimate:** 1 / 2 / 3 person-days. **Confidence/assumptions:** Medium; familiarity and no new features beyond approved scope. **Risks/unknowns:** Eng time excludes owner approval wait/training attendees availability.

## Conditional and deferred tasks
| ID / title | Priority/category / evidence | Owner and bounded approach | Dependencies/parallelism | Acceptance/verification | Low/likely/high days; confidence/risks |
|---|---|---|---|---|---|
| B15 Lab transition/role/occupancy invariants | P1 if labs enabled; backend/security; F15 | Backend/security: existing/new head-role protection, assistant/quota invariants on alternative acceptance, no early occupancy release | Signed HD-16; parallel core cloud but final tests after boundary repair | Role/proposal/cross-week/race/early attendance negative tests pass | 2/4/7; medium; policy values and concurrency |
| B16 Lab lifecycle, expiry and staff privacy | P1 if labs enabled; backend/product; F16 | Backend/product: auditable expiry/escalation, own-duty scope, correction/reopen/time checks | HD-16 reservation/privacy rules; after B15 invariant design | Stale rows free quota; expired approval denied; scoped duties; corrected attendance/reopened lab | 2/4/7; medium; policy unresolved |
| B17 Lab result UX and operator acceptance | P1 if labs enabled; UX/QA; F16/F17/F21 | Frontend/QA: persistent messages, flag matrix, member/head/assistant journeys, report reconciliation | B15/B16 and hosting; tests designed early | Manual attendance accepted by lab heads; actual journeys/flags/results pass | 2/3/6; medium; staff/devices/access |
| B18 Mentor intake and profile boundary | P2 or P1 if selected; product/backend; F19 | Truthful manual queue/account selector and minimal profile, or explicit scope/promise correction | Owner boundary choice; independent post-V1 | Intake→staff discovery→linked publication without engineer, or honest deferral | 1/3/6; low/medium; desired workflow unspecified |
| B19 Cohort metrics and reconciliation | P2; data/product; F20 | Define unique/date cohort, reconcile against tables, label cumulative events | Metrics owner/baseline; parallel post-V1 | Repeated events do not inflate people; outcomes match tables | 1/2/4; medium; definitions unknown |
| B20 Broaden secret/advisory assurance | P2; security; F22 | History/ignored configuration scan with redaction; exception owner/expiry; reachability review | Authorized history/runtime access | Scoped scan and exceptions recorded without values | 1/2/4; medium; no presumed rotation |
| B21 Measured query/design polish | P2; frontend/backend; F23 | Undefined tokens, images, pagination, batched lookups based on measurement | B13 results; post-V1 | Agreed budgets improve without journey regression | 1/3/5; medium; impact unmeasured |
| B23 Distributed architecture/multi-region | P3 optional; architecture | No implementation recommended now; reassess on actual SLO/scale | Evidence and owner business case | Scoped ADR only if justified | Not estimated; no verified need |

B15–B17 add **6 / 11 / 20 person-days**. B18–B23 are not in core totals. QR/PWA/offline/camera/signed passes are blocked design/scope gates, not zero-effort features; separately estimate after accepted threat model/device requirements.

## Totals and deduplication
Application-first B01–B14: **24 / 44 / 76 person-days**. Core + manual labs: **30 / 55 / 96**. Shared security/action/DTO/draft changes count once in B02; focused regression writing stays with fixes; B13 covers harness, integration and final acceptance only. TLS/DB identity count in B09 without duplicating specialist estimates. B01/B14 include engineering integration of approvals and handover; institutional legal/commercial labour and wait are excluded. Agent counts are never used as human capacity. Removing the disproved auth-bypass hypothesis does not eliminate B02's reproduced broad reader/DTO work; estimates remain provisional ranges.

### B22 — Prevent latent auth page-action exposure (deferred)

**Finding/category/priority:** F02; security/maintainability; P2. **Scope:** Replace unnecessary auth `use server` exports with ordinary server-only functions while retaining API wrapper protections, or enforce a deliberate common boundary. **Owner/modules:** Backend/security; auth actions and route callers. **Dependencies/parallelism:** Independent cleanup after core launch work; coordinate auth contracts. **Acceptance:** Existing auth routes retain CAPTCHA/limits/session behavior; compiled manifest has no unintended auth page workers; negative transport regression passes. **Estimate:** 1 / 1 / 2 person-days, excluded from V1 totals. **Confidence/risks:** High counterevidence for current bypass claim, medium cleanup effort; future page imports could change reachability.

