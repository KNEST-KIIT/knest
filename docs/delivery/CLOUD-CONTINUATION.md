# Production continuation handoff

**Current checkpoint (2026-10-17):** read `CONTINUATION-2026-10-17.md` first. The branch has already been pushed and substantially extended since this original 2026-10-09 handoff; runtime permissions, durable mail and reconciliation are implemented in source. An AWS private preview was reported subsequently. The supported Cloud picker still has no environment, and public deployment/domain acceptance remains incomplete. The remainder of this document is the historical initial handoff, not a current inventory of unfinished code.

The owner authorized implementation, AWS production deployment, domain connection and cloud continuation on 2026-10-09. Work is on `codex/production-v1`. Preserve received local changes and the audit evidence. Do not interpret a successful build as production acceptance.

## Read first

- `docs/audit/12-multi-agent-validation-addendum.md` reconciles the audit and withdraws the incorrect login-CAPTCHA claim.
- `docs/audit/08-prioritized-backlog.md` and `07-v1-production-definition.md` define the remaining release work.
- `docs/audit/13-implementation-progress.md` records implementation and validation after the audit.
- Read the relevant installed Next.js 16.4 guides under `node_modules/next/dist/docs/` before changing framework code.

## Scope and constraints

Use the existing modular monolith. Proceed with the application-first V1; keep `FEATURE_LAB_BOOKING=false`. Labs, QR, PWA and offline features are outside this release until explicitly accepted. Target AWS in Mumbai, with CloudFront/WAF/its ACM certificate in Virginia, `kiitnest.com` canonical and the other three hostnames redirected. No permanent staging stack. Verify privately with synthetic accounts before public cutover. Never use an AWS root session, publish secrets, seed real student records, invent institutional approval, or change mail DNS records as a side effect of web cutover.

## Implementation already started

Internal services now use `server-only`, with session ownership checks on private readers. Only Payload's intended Server Actions remain in the compiled action table. Reviewer DTOs exclude password hashes and staff cannot read drafts or download their documents. Uploads check question membership, actual byte length and file contents and remove superseded objects after commit. Reset token consumption/password/session revocation are transactional; staff changes share a lock and recheck actor authority to prevent cross-removal of the last admin. Browser forms use bounded network requests, mobile navigation no longer collapses, and staff-role edits require an explicit Apply action. Some received test selectors and shared-fixture assertions were repaired.

## Cloud task setup

The local Codex CLI is signed in, but its Cloud picker returned zero environments. The browser requires ChatGPT sign-in. A cloud task has **not** been created. The owner must create/select a Codex Cloud environment connected to `KNEST-KIIT/knest`. Once available, submit from the pushed `codex/production-v1` branch using the supported `codex cloud exec --env <actual-environment-id> --branch codex/production-v1` command. Never guess an environment ID or copy local credentials into a task prompt.

Use Node 24 and pnpm 10.33. Install with the frozen lockfile. Cloud setup must provide loopback/disposable PostgreSQL or `TEST_DATABASE_URL` ending in `_test`; integration tests refuse remote database hosts. Install Chromium for the test runner or select its available channel through `PW_CHANNEL`. `.env` files, database contents, `.next`, local logs and credentials are excluded from the push.

## AWS origin completion

`infra/cfn/origin.yaml` provides an HTTPS ALB origin with a regional ACM certificate, two public subnets, CloudFront-only port 443, app-group-only forwarding and a healthy-target alarm. Production `app.yaml` closes direct app ingress; S-1 retains its explicitly selected HTTP path. Supply the app stack's VPC, subnet, instance, security group and alert-topic outputs. Validate the certificate DNS record at the authoritative provider, then create `origin.kiitnest.com` pointing to the ALB output. Use this certified hostname, port 443 and `https-only` in `edge.yaml`. This follows the [AWS origin TLS requirements](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-https-cloudfront-to-custom-origin.html). The template is locally checked, **not** AWS-validated or deployed. Recalculate the production budget for the ALB and public IPv4 costs before provisioning.

The manual release workflow requires successful CI for its exact SHA and completed ECR scans with no high/critical findings for both app and migrator before exposing deployable digests. The ECR role permits reading its repository's scan results. These gates still need an actual AWS/OIDC rehearsal.

## Required work before launch

1. Connect a scoped AWS identity, DNS access and Codex Cloud environment; establish a billing/alert/support owner. At handoff no usable AWS credentials/CLI or production OIDC role variables were available, and GoDaddy remained authoritative.
2. Obtain the institution-approved privacy/terms/content and operating ownership required by HD-06. The owner's broad engineering authorization does not supply missing institutional policy text.
3. Replace RDS master use with separate runtime/migration identities and prove rotation/restart behavior. This remains a release blocker.
4. Implement durable provider delivery/retry, finish enquiry and event operating acceptance, and reconcile upload cleanup failures safely. Superseded-object deletion is best-effort; it is not an orphan-reconciliation system.
5. Validate/provision the infrastructure privately, prove real S3/SES/Turnstile, TLS, source-IP trust and DNS equivalence. Preserve Workspace MX/SPF/DKIM/DMARC.
6. Prove populated upgrades, snapshot restore, schema-compatible rollback, alarms/responder delivery, capacity and hosted browser/accessibility acceptance for the exact release SHA.
7. Connect public aliases and perform cutover only after all gates are accepted. Verify real HTTPS responses and redirects on all four hostnames. Record evidence and rollback state.

Continue all unblocked implementation work. Report missing access precisely; do not label this branch, a local test result or a cloud task as a finished production deployment.
