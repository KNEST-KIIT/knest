# Owner decisions, 2026-10-09

Recorded from the owner's "Owner Decisions and Controlled Execution Approval". This file is the record of what was approved, what is still a blank, and how each decision changes the plan. Where the owner's text still contains a template placeholder, it is listed as **NOT PROVIDED**; nothing has been filled in on anyone's behalf.

## What was decided

| # | Decision | Effect on the work |
|---|---|---|
| A1 | Pending factual confirmation: show account ID, account owner, billing owner and the authenticated identity | **Not yet possible.** The only session available was the root session `claude-deploy`; it has expired, and root is no longer to be used (A4). Needs the scoped identity in `S-1-PREFLIGHT.md` section 2. |
| A2 | S-1 infrastructure approved, conditional on preflight checks (SSM and image pull without inbound SSH, private RDS, isolation, all charges in the budget, an automated teardown, no leftovers) | Preflight written: `S-1-PREFLIGHT.md`. Nothing provisioned. |
| A3 | USD 25 total sandbox ceiling; alerts at 50/80/100%; the ceiling is an authorisation limit, not a guarantee | Cost-watch and teardown procedure in the preflight. |
| A4 | **No root session** for routine operations; the single least-privilege instance role and profile are approved; use a scoped identity; never create root keys | Root session set aside. Scoped operator policy drafted: `infra/s1/operator-policy.json`. The owner creates the identity (exact steps in the preflight). |
| A5 | Build the arm64 image in GitHub Actions; prefer a **private** registry package; no secrets in image or logs; deploy by immutable digest | Trade-off documented in the preflight (a private GHCR package needs a read-only pull token). Package stays private. |
| A6 | Budget alert e-mail | **NOT PROVIDED** (the text still reads "[OWNER-PROVIDED EMAIL]"). No budget created, no mail sent. |
| A7 | SES testing deferred in the spike; SES delivery and domain authentication stay **mandatory** gates before Pilot-A and production | Recorded as a staging gate in the tracker. |
| B1 | Preserve the `knest-app` key; investigate (creator, permissions, last-used, dependants, `setup-aws.ps1`, exposure); prepare migration to role credentials | Needs the scoped identity for the AWS-side inspection. Repo-side usage inspected (see below). |
| B2 | Keep and review the uncommitted `src/server/storage/index.ts` change | Reviewed (see below); to be integrated with a small related fix. |
| C1 | No production replacement; keep the maintenance page until the Pilot-A release gates pass | Unchanged. Preparing build, staging tests and release manifest. |
| C2 | Protect deployments that could expose unfinished functionality; keep the ability to show a safe public notice | Checked (see below). |
| C3 | Vercel is a temporary maintenance presence; AWS is the target; no DNS cutover yet | Unchanged. |
| D1 | Domain | **NOT PROVIDED** (the text still reads "[EXACT .COM DOMAIN]"). Read-only DNS discovery cannot start. |
| D2 | Commercial agreement pending, through a secure channel; do not commit it to a public repository | Nothing committed. Contract status stays UNVERIFIED. |
| D3 | Institutional approvers (HD-04, HD-06, HD-16) | **NOT PROVIDED** (placeholders). No approvals invented. |
| D4 | P1 support contact; transactional e-mail address | **NOT PROVIDED** (placeholders). |
| E | Proceed with all unblocked repository work; S-1 only after identity, networking and cost preflight; no production infrastructure, no DNS transfer, no public deployment | Proceeding. |

## Checks done today (read-only)

**C2, live deployments.** GitHub records 31 Vercel deployment URLs for the project. Anonymous requests: **29 redirect to Vercel's SSO login** (no application content), **2 answer `DEPLOYMENT_NOT_FOUND`** (already removed). The production hostname serves only the maintenance page (verified earlier on 2026-10-08/09 for `/`, `/blog`, `/programs`, `/admin`, `/api/lab-bookings?limit=0`, `/api/auth/providers`, and POSTs). Not covered: any custom domain or alias that is not recorded in GitHub, and the team's Vercel settings; there is no dashboard access from here (C2 asks only for what can be identified).

**B2, the foreign storage change.** Three small edits: a helper `s3Credentials()` that returns explicit `{accessKeyId, secretAccessKey}` from `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` when both are set and `undefined` otherwise, passed to both `S3Client` constructors. Consistent with the target design (`undefined` lets the SDK use the instance role). One gap: S3 was switched on only when `S3_ACCESS_KEY_ID` was set (`s3Configured`), so a host that uses a role and no key would have no storage in production (`putFile` throws when S3 is not configured there) and would use local disk in development. Integration (done): the original lines are kept as they were written, S3 is switched on by `S3_BUCKET` alone, and an optional `S3_ENDPOINT` (path-style) lets the test suite use an S3-compatible stub. The commit message says which lines are the other person's.

**B1, repository side (values were never printed).**
- The application reads the key only through `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` (`src/server/storage/index.ts`). No GitHub workflow or script uses it. The test harness blanks it (`tests/integration/global-setup.ts`).
- The real values exist in two local files on this machine, `.env` and `.env.local`. Both are git-ignored (`.gitignore` line 20) and **neither has ever been committed on any ref**. `.env.example` (tracked) has blank values.
- No access-key-shaped string (`AKIA` followed by 16 characters) appears in any tracked file or in the history of the repository.
- Not established: whether the key was used outside this repository or machine, who created it, its last-used time and its permissions (needs AWS access, blocked by A1), and whether the Vercel project has it as an environment variable (no dashboard access). **No exposure is established; none is ruled out beyond the repository.** If the key is set as a Vercel environment variable, that is a copy to account for in the migration.
- The migration to role credentials (instance role, no stored key) is designed in `S-1-PREFLIGHT.md` section 6 and starts once the scoped identity exists. The key is not deleted, deactivated or rotated.

## Later the same day: owner direction on the domain and AWS-native hosting

- `kiitnest.com` is the main domain; `kiitnest.in` is the redirect (answers DOM-1).
- Deploy on AWS only, with **all services AWS-native**, and route the domains through AWS. This supersedes the Cloudflare plan (and DOM-2 option B in `DOMAIN-DISCOVERY-2026-10-09.md`).
- Effect: `AWS-NATIVE-ARCHITECTURE.md` is the new target design (Route 53, ACM, CloudFront, WAF, EC2, RDS, S3, SES, ECR, SSM, CloudWatch). It lists the new approvals it needs (ARCH-1 to ARCH-5) and a safe order of work that starts with a delegated `staging.kiitnest.com` zone, so the apex and the live Google e-mail are not touched until the nameserver cutover is separately approved.
- Not changed by this direction: no AWS resource has been created, no DNS has been edited, the maintenance page stays, and the S-1 gates (scoped identity, budget e-mail, teardown roles) still apply.
