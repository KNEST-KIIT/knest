# AWS-native architecture, ONE production environment (owner decisions of 2026-10-09)

**Status: DESIGN. Nothing is provisioned and no DNS is changed.** Final owner decision: deploy directly to AWS production, **no staging environment**, no `staging.kiitnest.com`, no second hosting stack. The disposable S-1 spike is the only sandbox and is not a staging environment. Cost: `AWS-PRODUCTION-BUDGET.md`.

## 1. Services

| Layer | Service | Notes |
|---|---|---|
| DNS | Route 53, hosted zones for `kiitnest.com` and `kiitnest.in` | Registrar stays at GoDaddy. Only the nameservers move, at the approved cutover. |
| Certificates | ACM, **us-east-1** for CloudFront | Public certificate for `kiitnest.com`, `www.kiitnest.com`, `kiitnest.in`, `www.kiitnest.in`. Origin-side TLS is checked separately (see section 3). |
| Edge | CloudFront | Canonical host `kiitnest.com`. A CloudFront Function permanently redirects `www.kiitnest.com`, `kiitnest.in` and `www.kiitnest.in` to `https://kiitnest.com` keeping the path and query string. |
| Edge protection | AWS WAF (CLOUDFRONT scope, us-east-1) | Managed rule groups and rate-based rules only. No paid WAF CAPTCHA or Bot Control. |
| CAPTCHA | **Cloudflare Turnstile** (standalone widget and server-side verification) | Contractual requirement, kept. It needs no Cloudflare DNS or CDN. |
| Compute | EC2 `t4g` (Graviton) running the container | Sizing confirmed by S-1. |
| Database | RDS PostgreSQL 16, private subnets, encrypted, 7-day backups | Never public. |
| Documents, media | S3 (private, encrypted, versioned) | Instance role, no stored keys. |
| Platform mail | SES (domain identity, DKIM) | Alignment through DKIM so the existing SPF record is not edited (section 4). |
| Registry, CI/CD | Private ECR; GitHub Actions with OIDC short-lived roles | Role trust scoped to this repository, approved branches and a protected `production` environment. Images deployed by digest. |
| Operations | SSM Session Manager (no SSH), CloudWatch, SNS alerts, Budgets, CloudTrail | |

Not used: Cloudflare DNS/CDN, Vercel (after cutover), GHCR, any permanent second environment.

## 2. Request path and the rule that nothing sensitive is cached

Visitor, Route 53, CloudFront (TLS, WAF, redirect function), the origin (EC2 container), RDS and S3 inside the VPC.

- **CloudFront never caches HTML, API responses or anything session-specific.** The default behaviour uses the managed `CachingDisabled` policy and forwards the session cookie, so every dynamic response reaches the origin. Only fingerprinted build assets (`/_next/static/*`) get a long TTL. The application also sends `Cache-Control: private, no-store` on `/api`, `/dashboard`, `/admin`, `/apply`, `/onboarding` and authentication pages, and this is asserted by an integration test (a second line of defence if a distribution is ever misconfigured).
- **Origin bypass:** the origin accepts HTTPS only from CloudFront (security group on the AWS-managed CloudFront prefix list) **and** requires a secret origin header, which the application rejects when missing. RDS has no public endpoint.
- **Client IP:** in production the rate limiter takes the address only from CloudFront's viewer-address header (valid only because the origin cannot be reached any other way), not from the client-supplied `X-Forwarded-For`. This closes KN-22c.

## 3. Origin networking: decision method

Owner requirement: evaluate CloudFront VPC origins with a private EC2 against a public EC2 restricted to CloudFront, and pick the lowest-cost secure, maintainable option demonstrated by S-1. The comparison is in `AWS-PRODUCTION-BUDGET.md` section 4 (a private instance needs a NAT gateway or about six interface endpoints, roughly USD 40+ per month, which about doubles the bill). **Planned choice: public subnet, inbound only from CloudFront.** S-1 will exercise both options on a CloudFront default hostname (no DNS needed) and record the result; I will not choose by assertion. Origin TLS: CloudFront to origin over HTTPS with a certificate on the instance (ACM for CloudFront does not install on EC2); the options (a private-CA/Let's Encrypt-style certificate on the host, or terminating at a small proxy) are tested in S-1 and the simplest that works is chosen.

## 4. Domain and e-mail migration (direct, no staging subdomain)

Current facts are in `DOMAIN-DISCOVERY-2026-10-09.md`; the saved record snapshot and procedure are in `DNS-MIGRATION.md`.

1. **Inventory and snapshot** every GoDaddy record (done for the records visible; re-confirmed immediately before cutover).
2. **Build the Route 53 zones** with every existing record reproduced exactly (MX `smtp.google.com` priority 1, Google verification TXT, SPF TXT and its include TXT, DMARC TXT, `_domainconnect`), and prove equivalence with `scripts/dns-compare.mjs`, which queries both name servers directly and diffs every record type. No live change.
3. **Certificate before cutover.** ACM DNS validation needs a CNAME in the authoritative zone. Before cutover that is GoDaddy, so the only GoDaddy additions before the nameserver change are the ACM validation CNAMEs and the SES DKIM CNAMEs: additive, exact values shown to the owner first, no existing record touched. The same records are also created in Route 53.
4. **SES without editing SPF.** DMARC passes when either SPF or DKIM aligns. SES mail is DKIM-signed with the `kiitnest.com` domain, so the existing SPF record is left alone. Whether to add an SES SPF include is a separate decision with a before/after.
5. **Private first.** The production distribution is deployed with access restricted (an edge rule allows only owner-approved addresses, or serves the maintenance page) and reached on its default `*.cloudfront.net` hostname. Verification runs there, on the real production stack, with synthetic accounts and no real student data.
6. **Cutover (needs the owner's approval of the exact manifest):** lower TTLs a day before; change the four nameservers at GoDaddy to the Route 53 set; watch resolution from several resolvers; open the distribution to the public. **Rollback:** restore GoDaddy's nameservers `ns43.domaincontrol.com` and `ns44.domaincontrol.com` (still holding the old zone, which is left untouched for at least a week).
7. DNSSEC stays off until after stability.

## 5. What changed in the plan

- Removed: `staging.kiitnest.com` delegation, S-2 staging stage, any permanent second environment.
- Kept: S-1 as a disposable spike. Its scope grows slightly to include a CloudFront test distribution on a default hostname (to compare origin options) and an ECR push through the OIDC role (to prove image delivery), both inside the USD 25 ceiling and deleted at teardown.
- Turnstile is implemented in the application (verification on the server, configurable verify URL so tests need no internet).
- Verification that would have run on staging now runs in three places before the public sees anything: the local and CI test suites (real PostgreSQL, real browser, production build, production Docker build), the S-1 spike, and a private production smoke test.

## 6. Open items for the owner

| # | Item |
|---|---|
| 1 | The scoped AWS identity (`S-1-PREFLIGHT.md` section 2; the policy was widened for the S-1 edge and ECR checks, so use the current `infra/s1/operator-policy.json`). |
| 2 | The budget alert e-mail address. |
| 3 | Approval of the exact teardown role policies (`infra/s1/teardown-roles.json`). |
| 4 | Approval of the exact GoDaddy additions before cutover (ACM and SES CNAMEs): values are produced after the zones exist. |
| 5 | The production bill (`AWS-PRODUCTION-BUDGET.md`) and a production ceiling. |
| 6 | The privacy and terms approver (HD-06) and the other institutional inputs. |
