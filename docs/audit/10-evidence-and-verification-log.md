# Evidence and verification log

Audit date: 9 October 2026, Asia/Calcutta. Read-only application/infrastructure/data audit authorized by the attached CTO mandate. Only this audit package and its evidence were written in the original repository.

## E01 — Baseline and preservation

Repository: `C:\Users\anand\Desktop\knest`. Branch `delivery/p1-containment`; HEAD `27d3dcd242687aa4099e71b1f381d468054ee3d9`. Remote: public [KNEST-KIIT/knest](https://github.com/KNEST-KIIT/knest); remote default branch `claude/knest-ecosystem-platform-g9erjs`.

Pre-existing working-tree paths, preserved as received:

```text
 M docs/handover/STAFF-WALKTHROUGH.md
 M src/app/(staff)/admin/layout.tsx
 M src/components/layout/site-header.tsx
 M src/server/labs/service.ts
 M tests/support/turnstile-stub.ts
?? src/components/layout/logout-button.tsx
?? tests/integration/36-journey-student.test.ts
?? tests/integration/37-journey-staff.test.ts
?? tests/integration/38-journey-lab-booking.test.ts
?? tests/support/journey.ts
```

An isolated snapshot of 793 tracked/nonignored working files, including these changes, was created at `C:\Users\anand\AppData\Local\Temp\knest-audit-c080832f403e4df580f9c29d4adea561`. SHA256 baselines are in its `audit-baseline.json`. Installed dependencies were linked into that disposable copy; no dependency installation was performed. Ignored `.env` and `.env.local` were neither copied nor read. Generated Next build/type files and audit-only probes live in the disposable copy.

Final SHA256 comparison: **793 baseline files checked; 0 changed or missing**. Final Git status preserves all ten received paths and adds only the twelve requested reports plus evidence under `docs/audit/`. Existing historical audit was preserved. No application/infrastructure file was changed by the audit.

## E02 — Sources and investigation method

- Root AGENTS.md and supplied instructions; installed Next 16.4.0 guides `node_modules/next/dist/docs/01-app/02-guides/data-security.md` and `output.md` before considering action/build behavior.
- README, PRODUCT_ARCHITECTURE, USER_JOURNEYS, CONTENT_SPEC, CURRENT_STATE, TRACKER, LOCAL-COMPLETENESS, prior forensic audit and handover guides.
- Delivery decisions dated 2026-10-09, contract traceability/commercial generation sources, HD-04/HD-06/HD-16, lab design and donor map. Received signed commercial document was not available; generated contract claims are not treated as owner acceptance.
- Package manifests/lockfile, Next/Payload configuration, all route/module families, application and CMS schema/migrations, security/auth/session/role boundaries, uploads/storage/mail, analytics and lab domain services.
- Unit/integration/browser fixtures, Dockerfile, CI/release workflows, AWS app/edge templates, budget/runbooks and recent Git history. GitHub repository metadata, current CI jobs/logs, and visible open issue/PR lists (both empty at query time).
- Safe public DNS/HTTP inspection only. No authenticated cloud inventory, production POST, intrusive scan, real credential test, real email, persistent migration, deployment or configuration change.

Evidence labels: **verified execution** means a recorded check was actually run; **source-confirmed** means code establishes the stated behavior; **strong inference** needs specified runtime proof; **documentation claim** is not implementation evidence; **unknown** means access/evidence was unavailable. No numeric completion or coverage percentage is asserted.

## E03 — Native specialist execution

Native delegation was available and executed, with bounded read-only investigations and sensible concurrency. Five specialists covered the eight requested roles; paired roles are disclosed rather than represented as eight independent agents:

| Agent | Roles | Work performed |
|---|---|---|
| `/root/product_ux` | CPO/product manager; frontend/UX | Personas, journeys, source states, accessibility, scope and acceptance |
| `/root/architecture_data` | Principal architect; backend/data | Topology, schemas, boundaries, invariants, migrations, integrations |
| `/root/security_sre` | Application security; DevOps/SRE | Threats, auth, infrastructure, deployment/recovery, public GET/DNS evidence |
| `/root/qa_lead` | QA/test automation lead | Test inventory, harness/gate weaknesses and risk-based acceptance |
| `/root/red_team` | Independent challenger | Top risks/gaps, counterevidence, estimates, false-completeness checks; follow-up challenge of fresh evidence |

Specialists did not edit application files or run shared builds/databases. Root owned isolated command execution, browser inspection, scope reconciliation, severity, estimates and verdict. Reports 03–06 consolidate their findings; report 11 records challenges and corrections.

## E04 — Executed checks

Local runtime: Node v24.16.0, pnpm 10.33.0, Windows PowerShell. Unless stated otherwise, commands ran in the isolated current-disk copy. Builds used synthetic secrets and an unavailable loopback database, not production configuration. Integration used a disposable embedded PostgreSQL 16 database plus loopback SMTP/S3/Turnstile stand-ins.

| Command / evidence | Actual result | Interpretation / limitations |
|---|---|---|
| `git status --short`, branch/revision/log and remote inspection | Baseline above | Current disk differs from committed CI candidate |
| `pnpm exec eslint src tests` | Exit 0; 0 errors, 31 warnings | Warnings include unused symbols, raw images and navigation guidance; not zero-warning acceptance |
| `pnpm exec tsc --noEmit --incremental false` | Exit 0 | Strict static type check; not runtime correctness |
| `pnpm test` | 33 files; 348 passed, 1 SES unit timeout | Initial parallel run failed; retain this evidence |
| `pnpm exec vitest run --maxWorkers=2` | 33 files, 349 passed; 51.69 seconds | Bounded-worker rerun passed; SES SDK is mocked |
| `pnpm build` | Exit 1: Turbopack rejects linked node_modules outside filesystem root | Isolated dependency-layout limitation; does not establish a product build defect |
| `pnpm exec next build --webpack` | Exit 0, compile and type validation complete | Production webpack build succeeded; tracing warnings from linked dependencies and DB-unavailable CMS warnings. Did not invoke pnpm postbuild or certify standalone packaging |
| `node scripts/scan-secrets.mjs` in original repository | Exit 0; no recognized secret patterns in 762 candidate files | Current tracked shape scan, not full history/ignored runtime files/untracked files or all secret types |
| `pnpm audit --prod --audit-level=moderate` | Exit 0; two ignored vulnerabilities: one moderate, one high | Exceptions GHSA-vfj7-8cjw-p6xm and GHSA-67mh-4wv8-2f99. This is not zero vulnerabilities |
| Fresh `.next/server/server-reference-manifest.json` inspection | Sampled four exports registered | listApplicationsForUser, listNotificationsForUser, loginWithPassword, getApplicationForReview. Registration is stronger than stale source/build speculation; runtime results are separate below |
| `pnpm test:integration`, current-disk copy plus audit-only file | **Failed: 4 files failed, 20 passed; 7 tests failed, 308 passed, 1 expected failure; 316 total, 892.43 seconds** | Includes four audit probes that initially failed to demonstrate their claims. Original 23-file suite alone: 3 failed, 308 passed, 1 expected failure, 312 total |

The integration command's environment was sanitized before process start: inherited AWS/S3/SES/AUTH/PAYLOAD/SMTP/DATABASE/TEST/TURNSTILE/VERCEL/origin/site/mail selectors were removed, `EMAIL_TRANSPORT=smtp`, `AWS_EC2_METADATA_DISABLED=true`, `PW_CHANNEL=chrome`, and telemetry disabled. Setup then injected only its synthetic values. This prevents the inherited SES selector issue identified in F21 from sending real mail. Migrations were run only against that newly created disposable database.

### Existing integration failures, accurately separated from product defects

1. `36-journey-student.test.ts:247`: `getByText('2 unread')` matches a visible badge and screen-reader status text. Playwright strict-selector failure; no demonstrated notification failure.
2. `37-journey-staff.test.ts:170`: first text match for `Not this time` is a hidden select option; visible assertion times out. Selector flaw; not proof that the recorded decision failed.
3. `40-analytics.test.ts:36`: expected global accepted-event count 0, observed 1 after the preceding staff journey created an accepted event. Shared-database fixture/baseline contamination. Earlier forged-outcome HTTP 400 and unchanged-total assertions passed. This does not establish forged-event acceptance.

These explanations do not turn the failed release gate green. Isolate/fix fixtures and selectors, then rerun the exact committed release candidate. The expected-failure analytics/XFF test is separately documented in F21; it does not demonstrate a live edge bypass.

## E05 — Boundary probes and bounded conclusions

Audit-only source is retained in [boundary-reproductions.txt](evidence/boundary-reproductions.txt); it was added only to the disposable copy, never to application tests. All accounts/records/passwords were synthetic. Probes use fresh registered action IDs and actual POST transport, with no credential guessing or real email.

Initial four probes against `/login` received HTTP 200 but failed their payload/session assertions. A diagnostic rerun reproduced four failures in 46.58 seconds: each returned `application/json`, body `{}`. This was a transport-targeting mistake, not evidence of four prevented attacks or four successful exploits.

Fresh worker inspection showed the private readers also registered in page workers, while auth exports occurred only in API-route workers. Installed Next `manifests-singleton.js:269–341` and `action-handler.js:134–235,494–503` explain forwarding to the first worker and the empty non-RSC fallback. The red-team reviewer independently confirmed this distinction.

The next focused run used matching page workers: **three reproduction assertions passed, auth bypass assertion failed**, 49.09 seconds. The auth test was then corrected to assert its observed counterexample rather than the disproved hypothesis. Final command:

```text
pnpm exec vitest run --config vitest.integration.config.mts tests/integration/90-audit-boundaries.test.ts --reporter=verbose
```

Same sanitized environment and newly disposable DB/stubs: **4 passed, 1 file, 43.82 seconds**, start 17:43:45 local time. Results:

| Probe / request page | Response and assertion | Conclusion |
|---|---|---|
| Anonymous `listNotificationsForUser(otherId)` → `/contact` | HTTP 200, text/x-component, synthetic private-notice marker returned | F01 anonymous private notification read locally confirmed |
| Anonymous `listApplicationsForUser(otherId)` → `/dashboard/applications` | HTTP 200, text/x-component, synthetic staff-note marker and draft returned | F01 anonymous application/private-note read locally confirmed |
| Valid synthetic login with no CAPTCHA → `/login` | HTTP 200, JSON `{}`, no session cookie; ordinary login API rejects missing CAPTCHA | F02 bypass NOT established; initial P0 withdrawn, P2 latent hardening only |
| Reviewer `getApplicationForReview(id)` → `/admin/applications/audit-probe` | HTTP 200, text/x-component, passwordHash field and draft status returned | F01/F14 reviewer excess-data/draft visibility confirmed; staff session required |

Probe output recorded booleans, response type/length and test results without printing credential hashes, tokens or session values. No production breach or internet exploitation is alleged. These are **passing reproduction tests of existing defects**, not evidence that the defects are fixed. The original full integration suite was not rerun after audit-only probe correction; its three existing failures remain unresolved.

## E06 — Browser inspection actually performed

Root used headless installed Chrome against the isolated production webpack server and synthetic fixtures. Safe GETs of `/`, `/login`, `/contact` at widths 1280 and 375 returned HTTP 200, with no page errors collected during those six visits. This is bounded page coverage, not all routes/roles/error paths. Homepage fixture wording is synthetic test content, not institutional approved content.

At 375×900, root opened the mobile menu and measured its panel top 72, bottom 72, height **0**, with header height 73 and body overflow hidden. The screenshot shows navigation overlaying hero content without a properly sized panel. Resizing the open menu to desktop width 1280 leaves body overflow hidden. These observations confirm F17's local menu/scroll defects. They do not establish screen-reader or broad responsive acceptance.

- [Mobile menu screenshot](evidence/mobile-menu-375.png)
- [Desktop login screenshot](evidence/login-1280.png)
- [Browser observations](evidence/browser-observations.json)
- [Menu measurements](evidence/mobile-menu-measurements.json) and [reproduction script](evidence/mobile-menu-reproduction.txt); port is the disposable run's historical port, not an active service.

No document overflow was measured at 375 on these three pages; home/contact showed a bounded 12-pixel desktop document overflow. This is not used as a broad mobile-breakage claim. No Lighthouse/load/slow-network benchmark or physical-device test was run.

## E07 — CI and hosting evidence

Root inspected `gh run list`, `gh run view 37917762374 --json jobs,...` and `gh run view 37917762374 --log`. [Exact HEAD CI](https://github.com/KNEST-KIIT/knest/actions/runs/37917762374) succeeded in all three jobs: static/unit/audit; build/migrate/integration; image/migration/nonroot/health smoke. Log shows 274 integration passes and 1 expected failure across 20 committed files. This verifies the committed revision's CI, not uncommitted changes, current-disk journeys, hosted services or release approval settings.

Safe public inspection at approximately 17:10 IST on 9 October:

| Surface | Observation | What it establishes |
|---|---|---|
| `https://knest-kiit.vercel.app` | HTTP 503 maintenance | Product is not publicly usable there at observation time |
| `kiitnest.com` | HTTP 200, 114-byte response not demonstrating KNEST | Domain response is not product readiness |
| `kiitnest.in` | NXDOMAIN from local resolver | No usable alias observed; authoritative/full-zone investigation still needed |
| `.com` DNS | NS ns43/ns44.domaincontrol.com; MX smtp.google.com priority 1; A 15.197.148.33 and 3.33.130.190 | Preserve current mail records; no claim of zone ownership or complete configuration |
| AWS resources/certificates/alarms/SES/IAM/RDS | No authenticated inventory | Configured templates cannot be called operational |

No public POST or intrusive probe was made. No AWS/cloud credentials or environment file values were requested, read or printed.

## E08 — External primary sources checked

Pricing and service behavior are temporally unstable; primary documentation was consulted. These support specific design/cost conclusions, not a claim that the account is configured correctly:

- [CloudFront custom-origin HTTPS requirements](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-https-cloudfront-to-custom-origin.html): trusted matching origin certificate requirement.
- [Secrets Manager managed rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets_managed.html) and [RDS managed secrets](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html): managed master credentials do not eliminate application identity/refresh design.
- [Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/), [VPC IPv4](https://aws.amazon.com/vpc/pricing/), [load balancing](https://aws.amazon.com/elasticloadbalancing/pricing/) and [SES pricing](https://aws.amazon.com/ses/pricing/): report 09's assumption-labelled allowances.
- [CloudFront flat-rate plans](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html) and [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/): alternatives require compatibility/sizing checks, not automatic savings.

Exact Mumbai compute/database line items and account-specific credits were not newly quoted. No billing access was available. Use a current calculator and owner-approved budget before provisioning.

## E09 — Coverage limits and next proof

Not executed: production penetration testing, real S3/SES/Turnstile authorization/delivery, cloud stack validation, default isolated Turbopack success, standalone local container rebuild, populated persistent-data upgrade, actual RDS/S3 restore, credential rotation, alarm delivery, protected release refusal, DNS/mail cutover, physical-device/screen-reader acceptance, sustained load or field performance. Remote CI image evidence is disclosed separately, not represented as local execution.

Uninspectable: cloud account/resources/permissions/billing, full authoritative DNS zone and registrar control, protected GitHub Environment settings, real historical data/object state, received commercial agreement, institutional approved policies/content and responder commitments. Missing evidence is not an invented defect or assumed pass.

No implementation, refactor, commit, push, deployment, production configuration or real-user write was performed. Reports define the work and acceptance needed for later explicit authorization.

## E10 — Report validation

All 12 requested reports exist. Relative Markdown links resolve. The matrix contains 54 requirements using only the mandated status vocabulary: 35 PARTIAL, 7 IMPLEMENTED BUT UNVERIFIED, 7 BLOCKED, 5 NOT IMPLEMENTED. No full module is VERIFIED COMPLETE; narrower executed behaviors are recorded above. Core backlog has 14 task rows whose estimates independently sum to 24/44/76 person-days. Conditional manual labs add 6/11/20. Optional work is excluded. Findings F01–F24 remain traceable, including the explicit withdrawal/downgrade of F02 rather than silently removing contrary evidence.
