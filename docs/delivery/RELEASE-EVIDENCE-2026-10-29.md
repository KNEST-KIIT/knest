# KNEST Production v1 Release Evidence & Verification Report

**Release Date**: 2026-10-29  
**Git HEAD Commit**: `27534a3652f876fe870d09b7149f9befe627f95b`  
**Branch**: `codex/production-v1`  
**Target Environment**: AWS Mumbai (`ap-south-1`) + CloudFront/WAF Edge (`us-east-1`)  
**Operating Persona**: Lead Development Engineer & Release Operator (Antigravity)  

---

## 1. Executive Summary & Production Gate Status

All primary release requirements, stakeholder document revisions, and quality gates have been executed from a clean state and verified:

| Gate | Execution Command | Result | Metrics / Scope | Evidence Status |
|---|---|---|---|---|
| **Code Linting** | `pnpm run lint` | **PASS (Exit 0)** | 0 errors, 0 warnings across all files in `src/` and `tests/` | Verified |
| **Strict Typecheck** | `pnpm run typecheck` | **PASS (Exit 0)** | 0 type errors across whole workspace (`tsc --noEmit`) | Verified |
| **Content Integrity & Honesty** | `vitest run src/content-integrity.test.ts` | **PASS (Exit 0)** | 20/20 passed; scans all source files for banned unapproved claims | Verified |
| **Secret Scanning Gate** | `vitest run infra/security/scan-secrets.test.ts` | **PASS (Exit 0)** | 4/4 passed; zero private keys, API secrets, or AWS credentials committed | Verified |
| **CloudFormation Retention** | `vitest run infra/cfn/retention.test.ts` | **PASS (Exit 0)** | 13/13 passed; enforces 5-year floor (`1827` days) for all log groups | Verified |
| **Fail-Closed Malware Security** | `vitest run src/server/security/malware-scan.test.ts` | **PASS (Exit 0)** | 17/17 passed; strict positive clean schema, 64KB streaming cap, timeout bounds, quarantine isolation | Verified |
| **Unit Test Suite** | `pnpm vitest run` | **PASS (Exit 0)** | **68/68 test files passed, 660/660 unit tests passed** | Verified |
| **Production Standalone Build** | `pnpm run build` | **PASS (Exit 0)** | **48 routes compiled**, `.next/standalone` created, static assets and brochure synced | Verified |
| **Public Pages Integration** | `vitest run --config vitest.integration.config.mts 31-public-pages.test.ts` | **PASS (Exit 0)** | 20/20 passed; zero broken internal links, `/admissions`, `/terms`, `/privacy`, sitemap verified | Verified |

---

## 2. Stakeholder Requirements Reconciliation

### Document 1: `KNEST Website changes.docx`
1. **Subdomain Migration**:
   - Replaced `https://sld.kiit.ac.in/mba` with `https://siel.kiit.ac.in/mba` across institutional role data and MBA program CTA in `src/app/(public)/about/page.tsx` (Lines 68, 182).
   - Zero occurrences of `sld.kiit.ac.in` remain in user-facing code.
2. **Institutional Naming (SLD -> SIEL)**:
   - All references unified to **School of Innovation & Entrepreneurial Leadership (SIEL)**.
   - Dean's administrative anchor updated to SIEL.
3. **Admissions & Key Dates**:
   - Created dedicated Admissions route `src/app/(public)/admissions/page.tsx` with "Admissions at a Glance".
   - **Cohort Start**: Explicitly published as **13 July 2027**.
   - **Application Deadline**: Reconciled outdated date (16 February 2027); published honest `Awaiting Confirmation · TBD` state.
4. **Brochure Asset & CTA Deduplication**:
   - Deployed official high-resolution brochure asset `KNEST (1).pdf` (14.6 MB) to `public/knest-brochure.pdf`.
   - Verified that `public/knest-brochure.pdf` is packaged into `.next/standalone/public/knest-brochure.pdf`.
   - Topmost CTA provides direct download (`download="KNEST-Official-Brochure.pdf"`).
   - Duplicate bottom "Request a Brochure by Email" CTA omitted.

### Document 2: `02_Terms_and_Conditions.docx`
- Implemented all 15 authoritative stakeholder clauses into `src/content/policies.ts` under `POLICIES["terms"]` and route `/terms`:
  1. *Acceptance and scope*
  2. *Platform operator and contact* (Plot-386, Sai Anandam, KIIT Campus 15B)
  3. *Registration, eligibility and accounts*
  4. *Acceptable use*
  5. *Applications and submissions*
  6. *Incubation, mentoring and funding*
  7. *Bookings, attendance and facilities*
  8. *User content and permissions*
  9. *Intellectual property*
  10. *Third-party links and services*
  11. *Suspension and termination*
  12. *Availability and disclaimers*
  13. *Liability and indemnity*
  14. *Changes, governing law and disputes*
  15. *Contact*
- Verified via `PolicyDocument` rendering and `tests/integration/31-public-pages.test.ts`.

### Direct Stakeholder Message: Data Retention Reconciliation
- Superseded legacy 10-year retention with **5 years retention then backup** across:
  - `src/content/policies.ts` (`POLICIES["privacy"]`): 5 years retention with explicit transfer to approved backup archive, DPDP Act 2023 legal basis, Ms. Charanjit Kaur designated data officer.
  - `scripts/ops/retention-evidence.mjs`: `FIVE_YEAR_LOG_DAYS = 1827`.
  - `infra/cfn/retention.test.ts`: CloudFormation retention floor set to 1827 days.
  - `tests/integration/31-public-pages.test.ts`: Verified `5-year retention period` on `/privacy`.

Complete clause-by-clause mapping available in `docs/delivery/STAKEHOLDER-DOCX-TRACEABILITY-2026-10-29.md`.

---

## 3. Production Malware Protection Architecture (Fail-Closed)

Rather than an insecure test stub, the production pipeline implements strict, defense-in-depth malware scanning:
1. **Heuristic Engine (`src/server/security/malware-scan.ts`)**:
   - Deep inspection beyond MIME/magic bytes: scans for standard EICAR AV signatures, embedded Windows PE executables (`MZ` / `PE`), ELF binaries, Mach-O binaries, weaponized PDF launch scripts (`/Launch`), and OpenXML macro containers (`vbaProject.bin`).
2. **Enterprise Remote Scanner Client**:
   - Strict positive clean verdict schema (`clean: true && infected: false`). Ambiguous payloads or `{}` fail closed.
   - Streaming reader with a hard 64 KB response boundary to protect against memory exhaustion.
   - Comprehensive 3000 ms timeout over network and body parsing.
3. **Production Fail-Closed Guarantee**:
   - In production (`NODE_ENV === 'production'`), if `MALWARE_SCANNER_URL` is absent, unreachable, or times out, the service unconditionally rejects uploads.
4. **Secure Quarantine Pipeline**:
   - Any infected or suspicious file is never admitted to primary document storage.
   - `recordQuarantinedFile` moves the payload with a `.quarantine` non-executable extension to S3 (`quarantine/` prefix) or isolated local storage, recording SHA-256 hash, user ID, application ID, and threat label.

---

## 4. Live Cloud Readiness & AWS Deployment Analysis

1. **SES DKIM Verification (GoDaddy DNS)**:
   - Verified that all three DKIM CNAME records are live and actively resolving on the public Internet:
     - `75ohff4pzwitcmydihb7jklo7qyfukfc._domainkey.kiitnest.com` -> `75ohff4pzwitcmydihb7jklo7qyfukfc.dkim.amazonses.com` (TTL 3600, Answer OK)
     - `5mexvr7dqa5u54x3agljcb5ybnozwzqq._domainkey.kiitnest.com` -> `5mexvr7dqa5u54x3agljcb5ybnozwzqq.dkim.amazonses.com` (TTL 3600, Answer OK)
     - `otzkgqkxkv3e5f3y5qy5kuddmwn2hvdl._domainkey.kiitnest.com` -> `otzkgqkxkv3e5f3y5qy5kuddmwn2hvdl.dkim.amazonses.com` (TTL 3600, Answer OK)
   - DKIM records are ready for SES detection; existing Google Workspace MX records remain intact.

2. **AWS Operator Identity Hard Gate**:
   - Active CLI session identity check (`aws sts get-caller-identity --profile claude-deploy`):
     `arn:aws:iam::166917387892:root`.
   - **Critical Directive**: *Never use AWS root credentials for deployment.*
   - CloudFormation service role `knest-s1-cfn-service` was created on 2026-10-29.
   - An authenticated operator session with the scoped IAM operator role/user is required to execute CloudFormation stack updates and Docker ECR deployments without violating root access policies.

3. **External Registrar Status**:
   - The `.in` apex domain remains under pending WHOIS verification at the registrar. CloudFront distribution and Route 53 apex aliases can be pointed as soon as the registrar hold clears.
