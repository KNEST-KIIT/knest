# Provisional production V1 definition

**PROVISIONAL, requiring owner approval.** Application-first V1 follows the original journeys and current Pilot-A/Pilot-B separation. The received commercial agreement and explicit variations determine contractual obligations. This report grants no implementation or deployment authorization.

## A. Mandatory journeys

1. Visitors discover truthful approved programs, resources and contact paths. Empty content and service outages are distinguishable.
2. People create accounts, sign in, understand collection disclosures, onboard, and retain their intended application destination through auth detours.
3. Members start/resume one draft per program, save validated answers, upload permitted files, verify email and submit once with clear confirmation.
4. Members see their own question snapshot, status and permitted decisions. Other users cannot access them; private notes and credential hashes never enter member payloads.
5. Reviewers access submitted applications, inspect frozen questions/files, make valid auditable transitions and notify applicants. Concurrent conflicting actions fail cleanly.
6. Authorized content/program staff publish and edit real content without a developer.
7. Administrators confirm role/deactivation changes deliberately. Sessions revoke correctly and at least one active superadministrator remains under concurrency.
8. Enquiries reach a named operator, can be handled and audited, and have visible support responsibility.
9. If basic events are included, registration/cancellation respects capacity, duplicate protection and past/external-event rules, with durable confirmation.
10. Expired sessions, verification/reset, offline/429/500 and provider failures give clear recoverable feedback without duplicate effects or data loss.

## B. Data and business correctness

- Explicit platform, staff and per-lab roles; current active-role checks and revocable sessions.
- Verified email and current program/deadline checks on submission; frozen question snapshot; no autosave/upload race with submission.
- Current file-question membership, actual byte/type limits, authorized downloads and approved replacement/orphan retention.
- State, audit and in-app notice commit together. External delivery has durable idempotent retries and cannot misreport committed work.
- Atomic reset/token/session and last-administrator invariants.
- Both app and CMS schemas survive populated upgrades and demonstrated restore. Historical CMS booking disposition is explicit.
- Retention/deletion and audit access follow institution-approved policy; durations and legal bases are not invented here.

## C. Security and operations minimum

Actual callable API and page-action boundaries enforce actor/resource scope and abuse controls. Caller-supplied identity never replaces the session. Minimal DTOs exclude credentials and staff notes. Production rejects unsafe configuration. TLS covers browser→edge→origin→RDS; origin identity and trusted address forwarding are proved. Private responses cannot enter shared caches.

Use role-based S3/cloud access and a runtime database principal separate from the migrator. Test rotation. Review dependency exceptions and image scans. Keep secrets out of logs/images. Approved privacy notices, copy and named operators precede real users. F02's initially suspected auth bypass was withdrawn: API-route-only registration does not establish a callable page action; see report 10.

## D. Proposed reliability and performance targets

These are assumptions for owner acceptance and measured proof, not current SLAs.

| Target | Proposal |
|---|---|
| Initial load | Up to 1,000 accounts, 20 concurrent interactive users, 1 million requests/month and 10,000 transactional messages/month |
| Availability | 99.5% monthly critical-flow target; explicitly accept single-instance/Single-AZ risks |
| Latency | Warm p95 reads ≤2 seconds; ordinary mutations ≤3 seconds; transfers/provider round trips measured separately |
| Mobile performance | LCP ≤2.5 seconds, CLS ≤0.1; field INP ≤200 ms when measurable; representative phones required |
| Recovery | RPO ≤15 minutes with tested PITR; RTO ≤4 hours with named operator access; revise if drills fail |
| Detection | Critical user-facing failure alert within 5 minutes; named escalation and published support hours |
| Backups | At least 7 days automated DB retention, pre-migration snapshot and tested S3 version recovery; approved bounded retention |
| Deployment | Explicit maintenance window and downtime budget for the initial single host |

Higher availability or tighter recovery commitments require corresponding redundancy, staffing and budget. Lighthouse is lab evidence; field experience needs real measurement.

## E. Release gates

| Gate | Required evidence | Current disposition |
|---|---|---|
| G1 Product/scope | Approved V1/contract variation, HD-04/06, named content/support/operations | BLOCKED/UNKNOWN |
| G2 Code quality | Exact candidate SHA, zero lint errors, strict types, unit/risk regressions, reviewed warnings | PARTIAL; current integration suite fails |
| G3 Security | Actual action/API negative tests, minimal DTOs, abuse/flag/config denial | FAIL: F01 and related repairs/proof |
| G4 Data | Successful drift command, empty/rerun/populated migration, race tests, historical-data disposition | PARTIAL |
| G5 Journeys/accessibility | All mandatory flows and failure states; keyboard, screen reader, mobile and zoom acceptance | PARTIAL; reproduced menu defect |
| G6 Hosted integration | Immutable private AWS candidate; real S3/SES/Turnstile, TLS, caching and identity proof | UNKNOWN/MISSING |
| G7 Recovery/release | Exact-SHA promotion, image scan disposition, schema compatibility, measured DB/S3 restore | FAIL pending drills |
| G8 Operations/cost | Delivered alerts, responder, rotation, retention, billing and runbooks accepted | MISSING/UNKNOWN |
| G9 Owner release | Signed acceptance, cutover manifest and domain/mail rollback plan | NOT GRANTED |

Code/template existence, mocked providers, test counts and old DONE labels cannot pass these gates.

## F. Monitoring and recovery

Monitor public HTTPS and dedicated synthetic critical journeys, errors/latency, DB connections/storage, host memory/disk, delivery failures and backups. Define controlled synthetic accounts and non-real submissions before operational probes.

Promote immutable digests from tested revisions. Pre-migration snapshots already exist in the template; restoring into a replacement database and reconnecting the application is separate. Define write freeze, schema compatibility, fix-forward versus restore, and potential post-restore write loss. Include S3 versions/object consistency. No automatic destructive restore or schema-down default.

## G. Excluded and conditional scope

Defer labs until separate Pilot-B acceptance; QR/signed passes/two-sided scans/cameras/offline sync/PWA; mentoring appointments; investor deal flow; marketplace/chat; full founder workspace; matching/recommendation engines; page builder; and distributed-platform expansion. Commercial exclusions require explicit variation: unbuilt does not mean unowed.

Mentor/profile promises need a truthful manual handoff or B18 before that journey is included. Defer elaborate analytics and cosmetic changes beyond measured budgets. Manual labs require HD-16, F15/F16 repairs, staffing/privacy/reservation/expiry decisions, flag-on/off negative tests and lab-head acceptance. Manual attendance cannot claim QR identity proof.

## H. Go/no-go checklist

- [ ] Approved scope/variation, privacy/copy and named owners.
- [ ] F01 repaired and actual boundary regression tests pass; F02 reachability correction retained.
- [ ] Secure runtime configuration, TLS, database identity and rotation proved.
- [ ] Exact-candidate release, populated migration, DB/S3 recovery demonstrated.
- [ ] Core UX, atomicity, upload, delivery, draft privacy and accessibility accepted.
- [ ] Current suite selectors/fixtures, drift status and flag-off coverage corrected and rerun.
- [ ] Real providers, cache privacy, alerts, support and cost controls proved.
- [ ] Staff training and owner acceptance completed.
- [ ] Labs remain off unless separately accepted.
- [ ] Explicit public release and DNS/mail cutover authorization obtained.

**Current verdict: NO-GO.** Maintain the real-user hold until every applicable gate has affirmative evidence.