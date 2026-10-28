# Release Evidence and Verification Log: 2026-10-27, revised 2026-10-28
**First written**: 2026-10-27 (IST). **Revised**: 2026-10-28, after the Phase 1 completion pass. Items the first version reported and this pass superseded are marked.  
**Branch / worktree**: `worktree-phase1-release` at `C:\Users\anand\Desktop\knest\.claude\worktrees\phase1-release`, created from base `27534a3`. The original checkout `C:\Users\anand\Desktop\knest` was not modified.  
**Role & authority**: sole development engineer pass (Sonnet 5.5; Codex supervised and wrote no product code). Phase 1 only: local implementation and verification. **No AWS, GitHub, GoDaddy, Cloudflare, DNS, email-provider or production call was made; nothing was pushed or deployed.**  
**Machine-generated detail**: [EVIDENCE/phase1-release-gates-2026-10-28.md](EVIDENCE/phase1-release-gates-2026-10-28.md) (per-batch and per-file counts, log checksums). Requirements to routes and tests: [STAKEHOLDER-REQUIREMENTS-TRACEABILITY-2026-10-27.md](STAKEHOLDER-REQUIREMENTS-TRACEABILITY-2026-10-27.md).

---

## 1. Verdict

- **Local release candidate: GO.** Every gate that CI defines and that can run without Docker, GitHub or AWS passed on a tree whose non-documentation files have content hash `e30c682e3aa5ffd8810e7d0b1c2e55758e4669fc3bc192f84ccaf83aebd43438` (960 files; section 2 explains how that is checked against the commit).
- **Production or public release: NO-GO.** Real malware detection is unproved until the hosted drill runs; the Docker image build, the GitHub Actions run and every AWS step are Phase 2; five owner decisions are open. Section 6 lists the exact blockers.

## 2. Gates, final results (2026-10-28)

| Gate | Command | Result | Exact counts and metrics |
|---|---|---|---|
| Lint | `pnpm run lint` (`eslint src tests`) | **PASS** (exit 0) | no findings |
| Typecheck | `pnpm run typecheck` (`tsc --noEmit`) | **PASS** (exit 0) | no errors |
| Secret scan | `node scripts/scan-secrets.mjs` | **PASS** | 1,109 files (every tracked file, with the new ones staged first because the scan reads `git ls-files`), none flagged |
| Design-token hardcode lint | `python scripts/lint_hardcodes.py src` | **PASS** | 525 files scanned, none flagged (one baseline defect, three `44px` literals in `status-form.tsx`, was fixed with `min-h-11`) |
| CloudFormation lint | `cfn-lint 1.58.0` over `infra/cfn/*.yaml` and the rendered S-1 `app` and production `ci` variants | **PASS** | zero findings |
| Unit tests | `npx vitest run --maxWorkers=1` | **PASS** | **81 files, 919 tests, 919 passed, 0 failed, 0 skipped** (the 2026-10-27 log recorded 68 files and 660 tests) |
| Dependency audit | `pnpm audit --prod --audit-level=moderate` | **PASS** (exit 0) | 2 advisories: 1 moderate, the documented accepted KN-03 entry in `pnpm-workspace.yaml`; 1 low, `deepmerge` via `payload`, below the threshold. No other advisory |
| Production build | `pnpm build` | **PASS** (exit 0) | compiled; 47 of 47 static pages; the five "missing secret key" lines are the CMS fallback during static generation and are identical in the pre-change baseline build |
| Bundle budget | `node scripts/check_bundle_budget.mjs` | **PASS** | JS 1,261,682 / 1,350,000 bytes gzip; CSS 102,052 / 120,000; largest JS chunk 365,475 / 420,000 |
| Integration tests | `vitest run --config vitest.integration.config.mts`, 10 sequential batches | **PASS** | **37 files, 472 tests, 472 passed, 0 failed, 0 skipped** (the 2026-10-27 log recorded 36 files and 442 tests) |
| ARM64 lockfile coverage | `node scripts/check-arm64-lockfile.mjs` and `infra/verify/arm64-lockfile.test.ts` | **PASS** | 1,063 packages; every Linux x64 native package has an arm64 twin of the same version (glibc to glibc, musl to musl); no package asks for a build step |
| Docker build-context typecheck (proxy) | copy of the files `.dockerignore` lets through, then `tsc --noEmit` | **PASS** (exit 0) | 880 of the 1,140 files Git knows about are in the context (only the five whitelisted stand-ins from `tests/`); proxy for the typecheck inside the image's `pnpm build`, with the Next-generated types carried over from the tested build; no error, so nothing the build needs is excluded |

**What "tested tree" means.** The gates ran on the working tree before it was committed. The content hash above covers every tracked file outside `docs/`. It was recorded before the final gates, re-checked after them, and compared with the hash of the committing revision: the last code commit is `23cfa66`, and the tree of that commit outside `docs/` hashes to the same value (verified after committing: 960 files, `e30c682e…`). The integration run used the production build whose `BUILD_ID` was written at 11:48:53 on 2026-10-28; no file under `src/` is newer than that build.

**How the suite was run.** The host had 0.6 to 2 GB of memory available throughout (two earlier background runs were reaped by the harness for low memory), so heavy gates ran strictly one at a time, unit tests with one worker, and the 37 integration files in 10 sequential batches of one to eight files, each batch its own vitest process with its own migrated database and production server. That covers the same files in the same name order as one run (`05-empty-cms`, which must run first, is in the first batch with `00-boot`); it is not a single process. The first full run of CI on GitHub will repeat it as one.

### Browser and journey matrix (production build, headless Chromium)

| File | Tests | What it proves |
|---|---|---|
| `35-accessibility` | 60 | WCAG 2.0 to 2.2 A/AA via axe-core across public routes (including `/terms`, `/terms/facilities`, `/privacy`, `/disclaimer`), member dashboard, lab screens, staff console, mobile menu and error states |
| `36-header-fit` | 22 | responsive navigation, no text or button overflow from 768 px to 1920 px |
| `36-journey-student` | 13 | registration, email verification, onboarding, draft application autosave, length bounds, submission gating, event registration, notifications |
| `37-journey-staff` | 14 | staff login, queue search, reading answers, review progression, two-step `alertdialog` confirmation, audit attribution, enquiry replies |
| `38-journey-lab-booking` | 10 | member booking, availability, staff decision console, cancellation, decline reasons |
| `44-account-network-failure` | 6 | dropped requests and retries across auth and form flows |
| `44-lab-attendance-qr` | 24 | ECDSA P-256 signed passes, two-sided check-in and check-out, offline outbox, clock-skew gating, forged-signature rejection |
| `70-core-journey` | 11 | closing end-to-end flow against the production build |

### Explicit boundaries of this pass
1. **Zero external mutations**: no CloudFormation, EC2, Route 53 or DNS change, no push, no GitHub call, no authentication to any external service.
2. **GoDaddy preservation**: no DNS record touched. The 2026-10-27 console observations (17 records, Google Workspace MX, three SES DKIM CNAMEs) are carried forward unverified in this pass.
3. **SES sandbox gate**: unchanged; the account stays in sandbox until AWS re-detects the DKIM records and approves production access.
4. **Hosted malware protection: designed, templated and tested locally; not deployed and not proved.** *(Superseded: the first version said no pipeline existed and hosted scanning was "blocked".)* See section 3A.
5. **Operator identity**: the 2026-10-27 console session was Root; every Phase 2 action must use a scoped role (`infra/iam/operator-policy.json`).

---

## 3. What this pass changed

### A. Document malware screening replaces the synchronous scanner *(supersedes 2026-10-27 item D)*
The synchronous HTTP scanner client, its loopback stub and their tests were removed (commit `acd176e`). Uploads now go to a private versioned quarantine bucket, GuardDuty Malware Protection for S3 scans each object version, EventBridge delivers the result to an SQS queue, and the application copies exactly the scanned version into a separate clean bucket only after a result bound to bucket, key, version and ETag, with state held in the database (HTTP 423 while pending; skipped, unsupported, failed, late or unknown results rejected). Design, verified AWS behaviour, limits, costs, alarms and the hosted drill: [MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md](MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md). The local S3, SQS and GuardDuty-event doubles under `tests/support/` are test doubles, not antivirus.

### B. Legal text and SIEL facts
`/terms` publishes the stakeholder Terms and Conditions (15 sections, 34 paragraphs, each section pinned by SHA-256, four documented editorial adjustments A1 to A4); the mentorship and facility terms moved unchanged to `/terms/facilities`. `/about` names the School of Innovation & Entrepreneurial Leadership, links `siel.kiit.ac.in`, shows the cohort start 13 July 2027, shows the application deadline as "Awaiting confirmation" (16 February 2027 is outdated and absent from source), and offers at most one brochure call to action or an honest "not available yet". The pages of the school's own website that the stakeholder list names are not in this repository; the handoff text is in the traceability document.

### C. Retention: five years, then approved backup and archive
`/privacy` states it (version label moved to 27 October 2026 because the text changed that day); CloudWatch log retention defaults to 1,827 days; applicant documents move to Deep Archive at 1,827 days and are never expired by the template, small files included; the evidence script and operator policy were aligned. Assessment, gaps and owner decisions: [RETENTION-ASSURANCE-2026-10-17.md](RETENTION-ASSURANCE-2026-10-17.md).

### D. Defects found while checking this work against AWS documentation and its own code (all fixed, each with a test written first)
1. **Verdict retries could be dead-lettered before their own deadline.** The worker retried every 30 seconds while the queue allowed 8 receives, so a good verdict could reach the dead-letter queue in about four minutes, and every replaced upload would have raised a false alarm. Fix: delay doubles per receive up to ten minutes (`scan-retry.ts`), the unknown-object wait is 5 minutes, `maxReceiveCount` is 12, and a template test derives the required number from the code.
2. **Small applicant files would never have been archived.** Since September 2024 S3 lifecycle skips objects under 128 KB by default. Fix: `TransitionDefaultMinimumObjectSize: varies_by_storage_class` on the documents bucket; the evidence script reports a gap if it is missing.
3. **The operator policy could not run the retention evidence script.** It listed `cloudformation:DescribeStackResources` but the script needs `DescribeStackResource`. Fix, plus wildcard-aware IAM tests (they now also catch an `s3:Get*`-style grant that the old literal check missed).
4. **The privacy policy kept its old date after its retention text changed.** Fix: version 27 October 2026, with unit and integration tests.
5. **`infra/cfn/app.yaml` (64 KB) exceeds CloudFormation's 51,200-byte inline limit**, so the documented `--template-body` commands would fail. Splitting the template would have reopened the owner-approved four-stack S-1 teardown IAM, so the runbook now uploads to S3 and passes `--template-url`, the operator policy has a `TemplateBucket` statement (write and read, no delete), and a test fails if any runbook passes an oversized template inline.
6. **The Phase 2 change-set pattern would have kept `LogRetentionDays` at 7** (`UsePreviousValue=true`). The runbook sets it explicitly.
7. **The ARM64 lockfile checker passed on input it could not parse.** Found by its own negative test; it now refuses unreadable input.
8. **Stale documents.** The cost plan priced a ClamAV sidecar and proposed expiring records at five years; five handover pages described the removed storage functions; `.env.example` lacked the four required screening settings. All corrected or marked superseded.

### E. Carried forward from the 2026-10-27 log (still true; their tests pass in the runs above)
1. **Answer length limits (KN-31).** `src/server/applications/validation.ts` enforces defaults of 500 characters for text and 5,000 for textarea questions when the CMS sets none (explicit CMS `maxLength` wins); `application-form.tsx` shows and binds the same limits; four unit tests cover it.
2. **Turnstile action and hostname binding (L-10).** `src/server/security/turnstile.ts` requires the route-bound action (`login`, `signup`, `password-reset`, `contact`, `application-submit`, `lab-booking`) and matches the hostname from `SITE_URL`, `NEXT_PUBLIC_SITE_URL` or `AUTH_URL`; six route handlers and six client widgets pass the matching action; stubs and helpers mint per-action tokens; `turnstile.test.ts` covers mismatches.
3. **HomeLink test discovery.** `src/components/layout/home-link.test.ts` renders the plain anchor and matches the vitest include glob.
4. **Staff journey two-step confirmation.** `37-journey-staff.test.ts` drives the `role="alertdialog"` confirmation for accepted and rejected decisions.
5. **Content-integrity timeout.** `src/content-integrity.test.ts` has an explicit 20-second timeout for the file-scanning test on Windows.

## 4. Tests were not weakened

Static comparison of test titles (every `it` and `test`) between revisions:

- Against the **carried-over baseline** commit `9f08b88`: 818 titles, **21 absent now**. 17 belong to the removed scanner suite `malware-scan.test.ts`, replaced as mapped in the traceability document (section 4); 4 are reworded tests in `27-document-upload` that now carry longer titles ("stores the bytes in quarantine only…", "EICAR (THREATS_FOUND) ends as infected…", "accepts a file of exactly 10 MB … and screens it like any other", "…through the staff route").
- Against the **original base** `27534a3`: 777 titles, **4 absent now**: the same three reworded upload tests, and "does not accept an invalid/short ten-year value" renamed to its five-year form.
- Since the base, 16 test files and 3 test-support files were added, and 24 test files and 4 support files were modified; nothing from the base was deleted. (The scanner suite and stub were introduced by the carried-over baseline and removed in this pass.) Edited expectations changed because behaviour changed on purpose (retry delay now escalates; IAM checks are wildcard-aware and resource-aware) and each edit made the check stricter or equal, never looser.

## 5. Not run, and why

| Not run | Why | Where it happens |
|---|---|---|
| Docker image build; CI `image` job (build, migrate from the image, runtime-role check, start, `verify-production.mjs`, container-refusal checks) | no Docker on this machine | GitHub Actions after the commit is pushed (Phase 2); the build-context typecheck and ARM64 lockfile gate above are proxies |
| ARM64 image build under QEMU | same | `release-image.yml` (Phase 2) |
| GitHub Actions run of CI | nothing may be pushed | Phase 2 |
| Anything in AWS: change set, GuardDuty plan creation, EventBridge delivery to SQS, **the hosted malware drill**, retention evidence collection | no AWS call may be made | [OPERATOR-COMMANDS.md](OPERATOR-COMMANDS.md) item 9 |
| Restore from Deep Archive | nothing is deployed | Phase 2, with a synthetic object |
| Mumbai GuardDuty price | not published on the pricing page; reference rates used | first bill |
| Manual accessibility review | axe finds about a third of real problems | owner-scheduled |

## 6. Blockers and owner facts

**Exact blockers to a clean release**
1. **Hosted proof of malware detection.** Until `scripts/ops/malware-drill-remote.sh ... --apply` prints eight PASS lines against a deployed stack, nothing proves that GuardDuty detects EICAR, reaches `ACTIVE`, or delivers events in account `166917387892`. Uploads must not be opened to the public before it passes.
2. **CI on GitHub for the exact commit**, including the Docker `image` job and the arm64 build.
3. **A scoped operator session and a private template bucket** (`knest-templates-166917387892`, not yet created; creating it is an owner action) so the 64 KB template can be deployed; the change set must set `LogRetentionDays=1827` explicitly.
4. Blockers recorded on 2026-10-27 and not re-checked: the `.in` registrar hold, the Root console session, SES sandbox exit, Turnstile production keys, HD-06 approval and a named go-live approver.

**Owner facts still needed**
1. The confirmed **application deadline** for the 13 July 2027 cohort.
2. The **brochure** file or public address.
3. **Governing law and venue** for the Terms and Conditions (the source supplies none; none was invented).
4. Confirmation of the engineering-supplied heading "Accounts and eligibility" (adjustment A1).
5. The **approved archive destination**, the retention clock, retrieval and legal-hold procedure, whether logs must also be archived before CloudWatch expires them, and whether a replaced draft file counts as an "uploaded document".

**Phase 2 safe commands**: [OPERATOR-COMMANDS.md](OPERATOR-COMMANDS.md) item 9 (template upload, validate, create change set without executing, read it, execute only after review, confirm the plan is `ACTIVE`, redeploy, dry-run drill, `--apply` drill, smoke test, retention evidence). Do it in S-1 first.
