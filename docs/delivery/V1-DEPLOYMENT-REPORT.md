# KNEST V1: deployment report

Date: 2026-10-11. Branch: `codex/production-v1` (default branch since this session).
Release image: commit `b4ff4b9`. AWS account `166917387892`, Mumbai (ap-south-1) with CloudFront, WAF and the CloudFront-side secret in Virginia (us-east-1).

**Status: private preview is live behind a password gate. Public launch on `kiitnest.com` has NOT happened.**

## 1. What is running

| Layer | Resource | State |
|---|---|---|
| Edge | CloudFront `E2OTPCVYDVDLPE`, `d1vipkpsr3l07w.cloudfront.net` | Live, password gated, WAF attached |
| WAF | `knest-production-web-acl` (rate limits and managed rules) | Live |
| Origin | Application Load Balancer, `origin.kiitnest.com`, ACM certificate issued | Live, target healthy, reachable only from CloudFront |
| App | `t4g.small` EC2 running the release image by digest | Healthy |
| Data | RDS PostgreSQL `db.t4g.micro`, 3 migrations applied, pre-migration snapshot taken | Available |
| Storage and secrets | S3 bucket, Secrets Manager (origin-verify replicated to us-east-1), SSM parameters | In place |
| CI and release | ECR repo, GitHub OIDC roles, exact-SHA CI gate, image scan gate | Working |
| DNS (GoDaddy) | ACM validation CNAME, `origin` CNAME to the ALB | Added. Mail records untouched |

### Verified from the outside (2026-10-11)

- Without credentials: HTTP 401 (gate works).
- With the preview login: `/`, `/events`, `/programs`, `/contact`, `/login`, `/api/health` all return 200; the home page title renders.
- The ALB hostname is not reachable directly (blocked by the CloudFront-only security group).
- `/admin` returns 404 through CloudFront. Not yet investigated (see section 3).

## 2. Work done this session

### Code and pipeline
- Committed and pushed the V1 candidate (91 files): server-only internal services, session ownership checks, upload validation, transactional reset and role changes, bounded form recovery, mobile navigation, HTTPS origin template, release gates, audit pack.
- Fixed a test selector (strict-mode ambiguity on the unread badge).
- Fixed a real layout bug: event cards widened `/events` by 8px at phone width (grid track and wrapping).
- Fixed the CI OIDC trust policy to accept GitHub's immutable subject claim and the environment's spelling.
- Moved the image to an Alpine base: Debian had no fixes yet for gnutls28, util-linux and zlib (2 critical, 9 high). The Alpine image scans with zero findings.
- Fixed two release-gate bugs: absent ECR severity counts (zero findings) were rejected as "no usable result", and the scan waiter failed before ECR registered the scan.

### Infrastructure
Created: `knest-production-ci`, `knest-production-app`, `knest-production-origin` (Mumbai), `knest-production-waf`, `knest-production-edge` (Virginia). Secret replica of `origin-verify` to us-east-1. Turnstile secret set to Cloudflare's public always-pass TEST value.

### Findings recorded
- `edge.yaml` reads the origin-verify secret in the stack's own region (Virginia) while `app.yaml` creates it in Mumbai. The secret has to be replicated, or the template changed. Document this in the runbook.
- The delegated GoDaddy session requires a one-time code sent to the account owner for every DNS change.
- The AWS CLI on Windows crashes printing the deploy script's check mark unless `PYTHONUTF8=1` is set.

## 3. What is left

### Immediate (small, unblocks real use of the preview)
1. **Set `SiteUrl` to the CloudFront address** (`https://d1vipkpsr3l07w.cloudfront.net`) in the app stack, then re-run the SSM deploy. It is still `https://kiitnest.com`, so form posts and sign-in from the preview address will be treated as cross-origin and refused.
2. Investigate `/admin` returning 404 (Payload admin route behind the gate).
3. Run a signed-in smoke test with a synthetic account: sign up, verify, apply, upload, staff review.

### Release blockers carried from the audit (not touched this session)
- Separate runtime and migration database identities. The app currently runs with the RDS master credential.
- Durable email delivery and retry. SES sender `no-reply@kiitnest.com` is not verified; mail will not send.
- Real Cloudflare Turnstile site and secret keys (the test pair always passes).
- Upload orphan reconciliation (superseded-object deletion is best effort).
- Institution-approved privacy, terms and content (HD-06). Engineering authorization does not supply this.
- Populated-data upgrade, snapshot restore, rollback, alarm-to-responder delivery, capacity and hosted accessibility drills for the exact release SHA.
- Billing and alert owner. `AlertEmail` is empty, so alarms notify no one.

### Public launch (needs your explicit go-ahead)
- Request an ACM certificate in us-east-1 for `kiitnest.com` plus the three other hostnames, validate it at GoDaddy.
- Add the aliases and certificate to the edge stack; remove the preview gate when ready.
- Point the apex and `www` (and the other three hostnames' redirects) at CloudFront without disturbing MX, SPF, DKIM and DMARC.
- Set `SiteUrl` to `https://kiitnest.com`, `SiteIndexing=on`, and re-deploy.
- Verify real HTTPS responses and redirects on all four hostnames; record rollback state.

### Hygiene
- Replace the root session with a scoped IAM identity and MFA; no root access keys.
- Allow-list the routine AWS commands in Claude Code settings so deploys need no per-step approval.
- Remove the temporary default-branch change if the team prefers `main`-style flow; merge `codex/production-v1` deliberately.
- Set an AWS Budget (suggested ceiling USD 75/month) with alerts to a real address.
- Delete the early `claude-deploy` profile's long-lived use once the IAM user exists.

### Explicitly out of V1 scope (unchanged)
Lab booking (`FEATURE_LAB_BOOKING=false`), QR attendance, PWA and offline features, and a permanent staging environment.

## 4. Running cost (estimate, one environment)
Roughly USD 65 to 76 per month: EC2 and EBS about 10, RDS about 18, ALB about 18 to 25, WAF about 10, other small items. Credits shown in the account (USD 100) offset the first period.

## 5. Where things are
- Preview gate login: local scratchpad file `preview-gate.txt` (not committed). Only its SHA-256 is in AWS.
- Release image digests: app `sha256:6705de24...`, migrate `sha256:2e3e57b8...`.
- Rollback: the SSM document restarts the previous container if the new one is unhealthy; database restore point `pre-migrate-20261011074349`.

## 6. Update 2026-10-11 (delegated continuation)

Status: **private preview only. Public launch has not happened and is gated on HD-06 approval evidence and real Turnstile keys.**

### Decisions taken on the owner's behalf (each with its reason)

| # | Decision | Reason |
|---|---|---|
| 1 | Set `SiteUrl` to the CloudFront preview address by change set, then redeploy | Same-origin write checks refuse form posts otherwise; change set showed only the SSM parameter changing |
| 2 | Treat `/admin` 404 as intended | Integration tests assert 404 for anonymous and student; staff get 200 |
| 3 | Interim alert and billing owner: `pinakipattnaik@gmail.com` | Owner's instruction; replace with an institutional mailbox before launch |
| 4 | AWS Budget `knest-production-monthly`, USD 100, alerts at 50 and 80 percent actual and 100 percent forecast | Estimated run rate is 70 to 95; ceiling leaves headroom |
| 5 | Runtime DB role `knest_app` (row access only), created by the migration job; app falls back to master with a loud warning if a release lacks it | Rollback and first deploy must not break |
| 6 | Durable mail outbox in the app database, with retries, expiry and an alarm | Smallest change that stops silent loss; no new AWS service |
| 7 | Orphan reconciliation runs as a daily dry run; deletion needs `STORAGE_RECONCILE=apply` | Counts must be seen before anything is removed; bucket is versioned |
| 8 | Public cutover uses Route 53 delegation (as `DNS-MIGRATION.md`) | GoDaddy cannot alias an apex to CloudFront |
| 9 | Scoped operator role plus MFA drafted, allow-list kept as a template and not installed | Settings and identity changes belong to the owner |

### Done and verified

| Item | Evidence |
|---|---|
| SiteUrl on the preview address, redeployed | Change set `siteurl-preview` (one Modify); SSM command `5791a6cb...` Success, container `healthy` |
| Runtime role | Local run: DML allowed; CREATE, DROP, ALTER, TRUNCATE, CREATE ROLE, CREATE SCHEMA denied (`DRILLS.md` D2) |
| Durable mail | `0011_email_outbox`, worker, alarm; unit tests for policy |
| Orphan reconciliation | `src/server/storage/reconcile*.ts`, unit tests for guards |
| Populated upgrade drill | `DRILLS.md` D1, 200 users and 50 enquiries survive 11 to 12 migrations |
| SES identity stack | `knest-production-ses` CREATE_COMPLETE, three DKIM tokens issued, DNS not yet added |
| ACM certificate | `knest-production-cert` requested, `PENDING_VALIDATION`, four CNAMEs listed in `CUTOVER-RUNBOOK.md` |
| Budget and alert address | Budget exists with three notifications; SNS subscription `PendingConfirmation` until the owner clicks the mail |

### Blocked, with the exact commands in `OPERATOR-COMMANDS.md`

- Signed-in smoke test on the live host (classifier blocked the remote run). The script `scripts/hosted-smoke.mjs` and runner are committed.
- External gate checks (the classifier blocked reading the preview password).
- GoDaddy record additions (account owner's emailed one-time code).
- Release of the new image and the app template update (needs CI green on the pushed commit, then the release workflow).
- Real Turnstile keys, HD-06 approval, SES production access, SNS confirmation.

### Not claimed

Restore, rollback, alarm-to-person, capacity and hosted accessibility drills for the exact release SHA are **not run** (`DRILLS.md` D4 to D8). The runtime role is proven locally, not yet on RDS.
