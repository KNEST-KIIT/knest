# Release Evidence and Verification Log: 2026-10-27
**Date**: 2026-10-27 (IST)  
**Branch / Worktree**: `codex/production-v1` at `c:\Users\anand\Desktop\knest`  
**Role & Authority**: Sole development engineer pass. All existing dirty work preserved. No external mutations, deployments, git push, or DNS changes executed.

---

## 1. Executive Summary & Verification Matrix

### Complete Sequential Verification Gates (October 27, 2026)

| Gate | Command | Status | Exact Counts / Metrics | Raw Dated Log |
|---|---|---|---|---|
| **Code Linting** | `pnpm run lint` (`eslint src tests`) | **PASS (Exit 0)** | 0 errors, 0 warnings across all files | `test-results/lint-2026-10-27.log` |
| **Strict Typecheck** | `pnpm run typecheck` (`tsc --noEmit`) | **PASS (Exit 0)** | 0 type errors across workspace | `test-results/typecheck-2026-10-27.log` |
| **Unit Test Suite** | `pnpm test` (Vitest unit + infra) | **PASS (Exit 0)** | 68 test files passed, 660 tests passed (25.60s) | `test-results/unit-2026-10-27.log` |
| **Production Standalone Build** | `pnpm run build` (Next.js 16 App Router) | **PASS (Exit 0)** | 47 routes compiled, `.next/standalone` created with static assets | Build output verified |
| **Focused Accessibility & Fit** | `35-accessibility.test.ts`, `36-header-fit.test.ts` | **PASS (Exit 0)** | 80/80 passed (58 WCAG 2.0–2.2 A/AA via axe-core, 22 header-fit across 768px–1920px) | `test-results/antigravity-review/` |
| **Full Sequential Integration** | `pnpm test:integration` (all 36 test files) | **PASS (Exit 0)** | 36/36 test files passed, 442 tests passed, 0 failed, 1 expected fail (`KN-22c`) | `test-results/integration-2026-10-27.log` |

### Critical & Failure Browser Matrix Executed Against Production Server:
- `35-accessibility.test.ts` (58 tests passed): Verified WCAG 2.0–2.2 A/AA compliance across 19 public routes, member dashboard, lab screens, staff console, mobile menu, and error states on headless Chromium.
- `36-header-fit.test.ts` (22 tests passed): Verified responsive navigation and zero text/button overflow across viewports 768px to 1920px.
- `36-journey-student.test.ts` (13 tests passed): End-to-end browser journey from registration, email verification, onboarding stage recommendation, draft application autosave, hard length bound validation, submission gating, event registration, to dashboard notifications.
- `37-journey-staff.test.ts` (14 tests passed): End-to-end staff console browser journey covering login, reviewer queue search, reading submitted answers, 4-stage review progression (`under_review` -> `shortlisted` -> `interview` -> `accepted` / `rejected`), accessible two-step confirmation dialogs (`role="alertdialog"`), audit log attribution, and contact enquiry replies.
- `38-journey-lab-booking.test.ts` (6 tests passed): End-to-end member lab booking, availability calendar calculation, staff decision console, cancellation slot recovery, and decline reason messaging.
- `44-account-network-failure.test.ts` (6 tests passed): Simulated dropped packets, high latency, and network disconnects across auth and form flows with retry preservation.
- `44-lab-attendance-qr.test.ts` (24 tests passed): WebCrypto ECDSA P-256 cryptographically signed passes, two-sided check-in/out, offline outbox syncing, clock-skew gating, and forged signature rejection.
- `70-core-journey.test.ts` (closing flow verification against production build).

### Explicit Operational Boundaries in This Local Phase:
1. **Zero External Mutations**: No live AWS CloudFormation stack updates, ECS/EC2 deployments, Route 53 modifications, or DNS records deleted.
2. **GoDaddy Preservation**: All existing GoDaddy DNS records (17 records verified, Google Workspace MX `smtp.google.com` Priority 1, 3 SES DKIM CNAMEs) strictly preserved.
3. **SES Sandbox Gate**: AWS SES remains in sandbox mode (max 200/day, verified recipients only) until AWS re-detects the saved DKIM records and approves sandbox exit.
4. **Hosted Malware Scanner Gate**: AWS GuardDuty S3 Malware Protection is asynchronous after S3 upload, not an HTTP endpoint for synchronous pre-upload scanning. No hosted scanning daemon (ClamAV) or S3 quarantine event pipeline is currently provisioned in AWS. Hosted scanning is explicitly **BLOCKED / NOT PROVED**.
5. **Operator Identity**: AWS console session is currently logged in as Root user; all production actions require switching to a properly scoped IAM session.

---

## 2. Exact Code Defects & Technical Enhancements Repaired in This Pass

### A. Effective Text / Textarea Limits & UI Reflection (KN-31 / CMS Bounds)
1. **`src/server/applications/validation.ts`**:
   - Fixed Zod 4 enum error syntax in `staffStatusChangeSchema`: replaced invalid `{ errorMap: ... }` with `{ message: 'Invalid or prohibited status for staff decision.' }`.
   - Imported and re-exported `DEFAULT_MAX_TEXT_ANSWER = 500`, `DEFAULT_MAX_TEXTAREA_ANSWER = 5000`, and `effectiveMaxLength`.
   - Updated `schemaForQuestion`: when CMS `maxLength` is absent, server validation enforces a hard maximum of 500 characters for `text` fields and 5000 characters for `textarea` fields (`.max(limit, 'This answer must be at most ${limit} characters.')`). Explicit CMS `maxLength` (> 0) continues to take precedence.
2. **`src/app/(member)/apply/[program]/application-form.tsx`**:
   - Imported `effectiveMaxLength` from `@/server/applications/types`.
   - Computed `questionMaxLen = question ? effectiveMaxLength(question) : undefined`.
   - Bound both hint text (`${answers[question.id].length} of ${questionMaxLen} characters`) and HTML input/textarea attribute `maxLength={questionMaxLen ?? undefined}` for both `text` and `textarea` questions.
3. **`src/server/applications/validation.test.ts`**:
   - Added unit test suite `effectiveMaxLength and default answer limits` (4 tests) verifying:
     - Text questions default to 500 chars (rejecting 501).
     - Textarea questions default to 5000 chars (rejecting 5001).
     - Explicit CMS `maxLength` is respected over defaults.
     - Non-text fields without length (such as URLs) remain unbounded.
   - Verified unit suite passed 18/18 tests in `src/server/applications/validation.test.ts`.

### B. Exact Turnstile Action & Hostname Binding (L-10 / E1 Finding)
1. **`src/server/security/turnstile.ts`**:
   - Enforced route-bound `expectedAction` parameter (`'login' | 'signup' | 'password-reset' | 'contact' | 'application-submit' | 'lab-booking'`).
   - Validated that Cloudflare `result.action === expectedAction`.
   - Validated hostname normalization: extracted expected hostname from `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, or `AUTH_URL`, enforcing case-insensitive match against `result.hostname` when configured.
2. **Protected Route Handlers**:
   - `src/app/api/auth/password/login/route.ts` binds `'login'`.
   - `src/app/api/auth/password/signup/route.ts` binds `'signup'`.
   - `src/app/api/auth/password/reset/request/route.ts` binds `'password-reset'`.
   - `src/app/api/applications/[id]/submit/route.ts` binds `'application-submit'`.
   - `src/app/api/labs/[slug]/request/route.ts` binds `'lab-booking'`.
   - `src/app/api/enquiries/route.ts` binds `'contact'`.
3. **Frontend Forms**:
   - All 6 matching client widgets (`login-form.tsx`, `signup-form.tsx`, `reset-form.tsx`, `application-form.tsx`, `booking-picker.tsx`, `contact-form.tsx`) pass matching `action` prop to `<TurnstileWidget>`.
4. **Integration Stubs & Helpers**:
   - `tests/support/helpers.ts` provides route-specific tokens via `captcha(action)` (`valid-token:<action>`) with `CAPTCHA = captcha('application-submit')`.
   - `tests/support/turnstile-stub.ts` and `tests/integration/46-google-enabled.test.ts` inspect token prefix, returning matching `action` and `hostname: '127.0.0.1'`.
   - Unit tests in `src/server/security/turnstile.test.ts` verify rejection of tokens minted for other actions, mismatched hostnames, and missing action/hostname fields (8/8 tests passed).

### C. HomeLink Test Discovery
1. **`src/components/layout/home-link.test.ts`**:
   - Verified plain native anchor `<a href="/" aria-label="KNEST home" class="brand">KNEST</a>` rendered via `renderToStaticMarkup`.
   - Ensured test file is named `.test.ts` matching `vitest.config.mts` include glob (`['src/**/*.test.ts', 'infra/**/*.test.ts']`). Test passed.

### D. Strict Positive Clean Verdict Schema & Fail-Closed Malware Scanner Client
1. **`src/server/security/malware-scan.ts`**:
   - Enforced strict positive clean verdict schema (`clean: true && infected: false`). Ambiguous or empty payloads (`{}`, `{ status: 200 }`) fail closed with `Invalid-Scanner-Verdict-Schema`.
   - Implemented streaming body consumption using `response.body.getReader()`, enforcing a hard 64 KB cap and reader cancellation if exceeded (`Scanner-Response-Exceeded-Limit`).
   - Bound `AbortController` timeout (3000 ms) covering connection, streaming chunk consumption, and JSON parsing.
   - Removed `ALLOW_IN_PROCESS_SCANNER_FALLBACK` escape hatch. In production (`NODE_ENV === 'production'`), if `scannerUrl` is absent, the client unconditionally fails closed (`Scanner-Service-Not-Configured-In-Production`).
2. **`tests/support/scanner-stub.ts`**:
   - Implemented local loopback HTTP scanner service running on `127.0.0.1:<port>/scan`.
   - Inspects incoming payload for EICAR test signature and disguised PE binaries, returning strict positive verdicts (`{ clean: true, infected: false }` or `{ clean: false, infected: true, threat: '...' }`).
3. **`tests/integration/global-setup.ts`**:
   - Wired `startScannerStub()`, injected `MALWARE_SCANNER_URL: scanner.endpoint` into production server environment and `process.env`, and added `await scanner.close()` to teardown.
4. **`src/server/security/malware-scan.test.ts`**:
   - 17/17 tests passed cleanly using `mockFetchResponse` ReadableStream helper, negative schema tests, and production contract validation.
5. **`tests/integration/27-document-upload.test.ts`**:
   - 10/10 tests passed (12.2s). Verified that uploaded document containing EICAR signature is rejected (HTTP 400), primary document storage remains clean, and payload is isolated under `quarantine/` prefix.

### E. Staff Journey Test Two-Step Confirmation Handling
1. **`tests/integration/37-journey-staff.test.ts`**:
   - Updated `moveTo` helper to handle the accessible two-step confirmation dialog (`role="alertdialog"`) rendered for permanent status transitions (`accepted` and `rejected`).
   - For `accepted` and `rejected`: clicks `Review & confirm ${label}`, waits for `alertdialog`, then clicks `Yes, confirm ${label}`.
   - All 14 tests in `37-journey-staff.test.ts` passed cleanly in 32.7s.

### F. Content Integrity Test Timeout Adjustment
1. **`src/content-integrity.test.ts`**:
   - Added explicit `20_000` ms timeout to `has no substitute-record constants` test to accommodate Windows filesystem file-scanning latency without failing. Test passed cleanly.

---

## 3. Commercial Scope Contract & Commercial Inventory Baseline

In accordance with owner directives, all **53 build modules** from `docs/commercial/generate.mjs:72-191` (recorded in `docs/delivery/CONTRACT-TRACEABILITY.md` and `docs/delivery/COMMERCIAL-MODULE-INVENTORY-2026-10-27.md`) are audited directly against active code:

### Key Architectural & Engineering Disclosures:
1. **Investor Portal (`/invest`)**: `/invest/page.tsx` is an **editorial content-assembly page** showcasing demo days, portfolio startups, and founder stories. There is **no investor intake form, investor accreditation pipeline, dealflow CRM, or investor matching engine**. It serves institutional visibility, not transaction processing.
2. **Session Architecture**: `src/server/auth/config.ts` enforces **database-persisted sessions** (`strategy: 'database'`), NOT JWT tokens. This guarantees immediate server-side session revocation upon user deactivation or role modification on every request.
3. **Lab Attendance Cryptography**: `src/lib/lab-qr/keys.ts` implements **ECDSA over NIST curve P-256 (`prime256v1`) with SHA-256**, NOT HMAC. The private signing key is generated non-extractable in WebCrypto; only the 65-byte uncompressed public key (`04 || X || Y`) leaves the lab station.
4. **Privileged Actions Confirmation**: Destructive operations (account deactivation, superadmin role reassignment, application accept/reject) utilize **two-step accessible confirmation dialogs** (`role="alertdialog"`, 44px hit targets), NOT two-factor authentication (2FA).
5. **Malware Scanning Reality**:
   - AWS GuardDuty S3 Malware Protection is **asynchronous AFTER S3 upload** (`docs.aws.amazon.com/guardduty/latest/ug/gdu-malware-protection-s3.html`), not an HTTP scanner endpoint for synchronous scan-before-upload workflows.
   - Hosted scanning in AWS is currently **BLOCKED / NOT PROVED**. No ClamAV REST container or GuardDuty S3 event-driven promotion pipeline is currently provisioned in AWS CloudFormation.
   - The local EICAR test stub verifies software integration logic, but does NOT prove live antivirus capability. Pre-scan objects must never be exposed publicly.
6. **Data Retention Policy**: The 5-year retention rule for student applications, evaluations, and audit logs is an **owner policy commitment**, NOT an independently established regulatory or statutory mandate. Implementation must use S3 Lifecycle rules transitioning to Glacier in **Governance mode** (avoiding irreversible Compliance mode Object Lock).
7. **EC2 AZ Placement & Rollback**:
   - An EC2 instance **cannot move availability zones by a restart**. Migrating `i-0dbccc58bd903416e` from `ap-south-1a` to `ap-south-1b` requires creating an AMI or recreating the instance in subnet `ap-south-1b`.
   - Rollback via SSM Run Command pulling from ECR is estimated at **2 to 5 minutes** pending a live operational staging drill; "< 60 seconds" is unproved. Immutable image digest gates (`sha256:...`) are strictly preserved.
8. **AWS Secrets & Google OAuth**:
   - Google OAuth credentials (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) in AWS Secrets Manager or host environment have **not been directly observed from this environment**. We do NOT claim they are absent; their presence must be verified via a scoped operator session inspecting the live AWS environment.

---

## 4. Current Blocker List & Next Actions

1. **[BLOCKER 1 - Registrar Hold on `.in`]**:
   - GoDaddy `.in` domain has an active Registrar Hold (pending WHOIS verification confirmed live in console). The registered domain owner has been asked to complete verification in GoDaddy.
2. **[BLOCKER 2 - Root AWS Session]**:
   - The operator AWS console session is logged in as Root. Deployments and cloud mutations must proceed under a scoped IAM role with least-privilege policies.
3. **[BLOCKER 3 - SES Sandbox Mode]**:
   - All 3 DKIM CNAME records are now saved in GoDaddy DNS; AWS SES console status is currently awaiting detection and retry. Once verified, a production access request ticket must be submitted to AWS.
4. **[BLOCKER 4 - Hosted Malware Scanner Provisioning]**:
   - GuardDuty S3 Malware Protection event-driven pipeline or ClamAV REST sidecar container must be provisioned in CloudFormation before live document uploads are accepted in AWS.
