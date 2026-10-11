# Testing and security audit
## Inventory and verified execution
Local Node v24.16.0/pnpm 10.33.0, installed dependencies reused without install. Test/build execution uses a disposable copy with no .env files or persistent database credentials. Detailed commands/outcomes and final integration/reproduction results are in [10](10-evidence-and-verification-log.md).
- 33 unit files under src/infra; local initial 348 pass + 1 timeout, rerun with two workers **349 pass**.
- 23 integration files in original working disk:20 committed +3 untracked browser journeys. Audit-only synthetic boundary file is additional and never added to application repository.
- Current-disk original integration suite: **308 passed, 3 failed, 1 expected failure**. Student/staff selectors and analytics shared-fixture assumptions fail; release gate remains failed. With the initial four audit probes included: 308 passed, 7 failed, 1 expected failure. Corrected focused probe results are separated in report 10.
- Exact committed HEAD CI [37917762374](https://github.com/KNEST-KIIT/knest/actions/runs/37917762374) succeeds in all three jobs: static/unit/audit, production build/empty-DB/integration, Docker migrate/runner/image smoke. Downloaded log shows **274 passes +1 expected failure in 20 integration files**.
- Local lint: 0 errors, 31 warnings. Strict typecheck passes. Default isolated Turbopack cannot follow linked dependency directory outside its filesystem root; supported webpack build succeeds with tracing warnings caused by that layout. This is not evidence the default committed CI build fails.
- No defensible coverage percentage, current Lighthouse budget, load test, live-provider test, screen-reader acceptance or full cross-browser/device result exists.
- Actual PG constraints and browser/HTTP behavior are tested, while S3/SMTP/Turnstile are local stand-ins. SES unit tests inject a fake SDK client. Those do not prove provider permissions/delivery.

## Threat model
| Actor / asset / boundary | Relevant threat | Present control | Remaining gate |
|---|---|---|---|
| Anonymous bot→auth/session | Brute force, CPU/mail/account abuse | DB bucket/CAPTCHA in API wrappers; no auth page worker found | Real edge/account/mailbox policy proof; F02 latent regression prevention |
| Member→other person's app/notifications | Identifier substitution | Guards on normal pages/API writes | F01 remotely callable readers |
| Reviewer→applicant/draft/credentials | Excess privileges/data minimization | Applications-area staff guard | F01 hashes/full user DTO; F14 draft isolation |
| Browser→edge→origin | Bypass trusted IP, TLS/cache privacy | Origin header/CSRF proxy, no-store, planned SG/WAF | F03/F05 real origin and HTTPS proof |
| App process→database | DDL/admin compromise, rotated stale credential | Private RDS/TLS planned | F06 least privilege/rotation |
| User document→staff download/storage | Type spoofing, malware, resource/storage abuse | MIME allowlist, byte sniff, attachment/nosniff | F12 question membership/retention/resource policy |
| CI/operator→cloud/image | Unverified release, excessive authority | SHA-pinned actions, OIDC/digest targets | F08 exact-SHA gates, external reviewers and scan proof |
| Operations→backups/logs/mail | Loss, delayed recovery, silent failure | Snapshots/runbook/3infra alarms configured | F07/F10 drills/owners, F13 retries |

Personal data includes identity/profile, applications/files, decisions, events and optional attendance. No tenant/business isolation model beyond cross-user/role/per-lab scope was established. No payment/financial transaction processing found. Institutional legal interpretation for Indian privacy/minors/retention must be supplied by the institution; this audit does not declare statutory compliance.

## F01 — Registered readers trust caller identity and return excess private fields
**High security severity, P0 release blocker; high source and local runtime confidence.** Three direct matching-page probes reproduced anonymous private notification/application-note access and reviewer hash-field/draft disclosure using synthetic records. Details and limitations are in [10](10-evidence-and-verification-log.md).
- `src/server/applications/actions.ts:1,20,29,318,333`: use-server exports accept supplied userId; ownership is compared against that supplied identity rather than session.
- `notifications/actions.ts:15–25`, `events/actions.ts:91,106` similarly expose private per-user reads.
- Fresh isolated build includes page workers for listApplicationsForUser, listNotificationsForUser and getApplicationForReview. Matching-page POSTs reproduce the claims. loginWithPassword has API-route workers only and does not establish a second callable auth path (F02). Other listed source exports require individual negative-boundary coverage.
- `applications/review.ts:68,72,95–96` **does** require applications staff but returns full related user, including passwordHash defined `db/schema/users.ts:33`. Synthetic reviewer invocation confirmed that field is serialized. This is excess credential disclosure to authorized reviewers, not an unauthenticated hash dump.
- Full application rows also contain decisionNote marked staff-facing only (`schema/applications.ts`); member-facing serialization should whitelist fields.
**Impact/likelihood:** confidentiality across users where target/action identifiers are known; stored credential hashes needlessly exposed to a less privileged role. Opaque action IDs do not replace authorization. No production breach is alleged.
**Remedy:** internal reads in ordinary server-only DAL; deliberate public actions obtain actor/session themselves, enforce resource scope and return minimal DTOs. **Verification:** raw compiled action calls anonymous/userA→userB/owner/reviewer; inspect serialized payload for absence of hashes/tokens/private notes. Page hiding is insufficient.
Framework evidence: installed `next/dist/docs/01-app/02-guides/data-security.md` describes direct POST action reachability, dead-code elimination and internal checks; no assumptions from older Next conventions were used.

## F02 — Auth action bypass hypothesis withdrawn; latent boundary risk
**P2 hardening; current CAPTCHA/rate-limit bypass NOT demonstrated.** Source functions in `auth/actions.ts:1,23,51,98,127` omit wrapper CAPTCHA/limits, but fresh manifest entries have only `app/api/auth/password/*/route` workers and no page worker. The raw login page POST returned HTTP 200 JSON `{}` and no session; it did not execute login. Installed Next worker selection/forwarding explains the result. The independent red-team reviewer confirmed this correction.

The initial P0 claim incorrectly treated all manifest registration as page-action reachability and is withdrawn. Keep route controls and consider ordinary server-only internal functions plus a manifest regression test preventing future page imports from creating an unguarded transport. This is B22, excluded from core effort totals. Other actual page mutations still require individual boundary assessment; do not generalize this counterexample to F01.

Separately, `verify/send` uses an IP+email key rather than a global mailbox limit. Adopt explicit account/mailbox policies under B03 where required by the threat model. No intrusive production scan, credential guessing or real mail was performed.

## F05 — Production startup does not enforce full deployment trust contract
**P1; medium/high severity conditional on configuration/origin access; high source confidence.**
`env.ts:15,25–26` permits DATABASE_SSL=off, optional origin-verification secret, and lacks secure AUTH_URL cross-check. `edge-guard.ts:guardRequest` disables secret check when absent. Production client IP defaults to CloudFront, whose header is forgeable if an origin is reachable without verification. Session secure-cookie choice depends on AUTH_URL (`auth/session.ts:38–55`).
Correct templates set these securely; no current deployed misconfiguration is established. Require AWS production TLS CA/origin secret/canonical HTTPS cookie settings and intentional synthetic-test exception. Prove missing unsafe configuration refuses startup and actual edge forwarding/direct-origin denial.

## F21 — Release tests leave material blind spots and one silent gate
**P1; high confidence.**
- `60-dependencies-and-migrations.test.ts:36–48` asserts no generated drift files but not subprocess status/error. A failed CLI producing nothing falsely passes. Check success before interpreting output; test gate failure using an isolated forced failure.
- Integration setup spreads inherited env, sets SMTP but does not force EMAIL_TRANSPORT. `email/send.ts:59` prioritizes SES; a parent SES selector/cloud credentials can escape stub. Audit execution explicitly sanitizes cloud/provider variables and forces SMTP. Fix fixture isolation and assert loopback transport.
- All integration global setup forces labs true; helper tests alone do not prove off-mode routes/pages/actions/navigation deny and no writes occur. Add second server/flag matrix.
- CI at HEAD cannot include untracked journeys/dirty implementation. Release must name an exact committed candidate and digest.
- Existing scans omit dynamic errors/menu and some roles/detail routes. Missing direct action-negative tests left F01 uncaught; F02 demonstrates why negative tests must also validate reachability assumptions.
- One `it.fails` in40-analytics proves a deliberately XFF-trusting test limitation, not an observed deployed CloudFront bypass. Reconcile stale comment and add normal trusted-source assertion.
**Verification:** risk-oriented failure injection, route/action negative matrix, no unhandled browser exceptions, real cloud proof, representative populated upgrade. No broad test count is a substitute.

## F22 — Dependency/secret audit scope and exceptions need accurate treatment
**P2 hardening; high confidence.** Scanner reports no recognized shapes in 762 current tracked candidate files; it does not cover full history/untracked runtime configuration/all secret types and silently skips unreadable files. No secret values were requested or printed. Original .env/.env.local were not copied or read.
`pnpm audit --prod --audit-level=moderate` exits0 with **1 moderate +1 high ignored** via GHSA-vfj7-8cjw-p6xm and GHSA-67mh-4wv8-2f99 in pnpm-workspace.yaml. This is no unignored threshold violation, not zero vulnerabilities. Validate exception reachability in shipped image, owner/expiry and current patched availability. No confirmed exposed credential was found; do not rotate/delete preserved existing cloud key solely on speculation.

## Security/release evidence needed
Exact-SHA lint/type/unit/build and reviewed dependency exceptions; real transport authorization/abuse tests; password/session/admin atomicity; draft/doc field isolation; upload lifecycle; approved data retention; private TLS/S3/SES/Turnstile proof; verified cache privacy and origin identity; least-privilege/rotation; restore/alert drills; product-owner acceptance. Cross-browser expansion and stronger nonce CSP may follow measured audience/risks; production unsafe-inline CSP is a documented mitigation tradeoff, not a demonstrated XSS exploit.

