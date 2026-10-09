# AWS-native architecture and domain routing (owner direction, 2026-10-09)

**Status: DESIGN. Nothing is provisioned and no DNS is changed.** Owner direction: `kiitnest.com` is the main domain, `kiitnest.in` redirects to it, every service is AWS-native, and the domains are routed through AWS. This replaces the Cloudflare plan in the earlier blueprint. Prices are my approximate list prices, not yet checked against the AWS price list (needs AWS access).

## 1. Services (all AWS)

| Layer | Service | Notes |
|---|---|---|
| DNS | **Route 53**, two public hosted zones (`kiitnest.com`, `kiitnest.in`) | Registrar stays at GoDaddy; only the **nameservers** change (needs approval, section 4). A registrar transfer to Route 53 is optional and separate. |
| Certificates | **ACM** (free), in `us-east-1` for CloudFront | DNS-validated through Route 53. Covers `kiitnest.com`, `www`, `kiitnest.in`, `www.kiitnest.in`. |
| Edge, TLS, redirect | **CloudFront** | One distribution for the app; a second small distribution (or the same one with a CloudFront Function) sends `kiitnest.in` and `www.kiitnest.in` to `https://kiitnest.com` with a 301, and `www.kiitnest.com` to the apex. |
| Edge protection | **AWS WAF** on CloudFront | Managed rule groups + rate-based rules for login, sign-up, reset and uploads. Replaces Cloudflare Turnstile with AWS WAF CAPTCHA/Challenge actions (see 5: the contract mentions Turnstile). |
| Compute | **EC2** `t4g` (Graviton) running the container | Provisional pending S-1 memory results; no inbound from the internet except CloudFront. |
| Database | **RDS PostgreSQL 16**, private subnets, encrypted, automated backups | Multi-AZ is an option decided after S-1 (cost). |
| Documents and media | **S3** (private, SSE, versioning for documents) | Instance role, no stored keys. A separate private bucket for documents. |
| Mail from the platform | **SES** (domain identity, DKIM) | DKIM CNAMEs and an SPF include are added beside the existing Google records (section 3). |
| Secrets and config | **SSM Parameter Store** SecureString (or Secrets Manager if rotation is wanted) | Fetched at start with the instance role. |
| Container registry | **ECR** (private) | Replaces GHCR (an earlier S-1 proposal). CI pushes to ECR with a GitHub OIDC role (no long-lived AWS key in GitHub). |
| Deploy and admin access | **SSM Session Manager** | No SSH, no port 22. |
| Logs, metrics, alarms | **CloudWatch** (logs, alarms), **SNS** for alerts | Alarms: 5xx rate, instance status, RDS storage and CPU, certificate and budget. |
| Cost guard | **AWS Budgets** | Alerts at 50/80/100%. |
| Audit trail | **CloudTrail** (management events) | |

Not used: Cloudflare, Vercel, GHCR in production. Vercel remains only until cutover, serving the maintenance page.

## 2. Request path

Visitor, Route 53, CloudFront (TLS, WAF, redirect rules), origin (EC2 running the container), RDS and S3 in the VPC. The origin security group accepts traffic only from CloudFront (the AWS-managed CloudFront prefix list), plus a secret origin header checked by the app or proxy; the instance has no other inbound. **To verify in S-1:** whether CloudFront's VPC-origin feature can reach the instance privately (preferred) or the prefix-list approach is needed; and that the real client IP is derived only from CloudFront's headers (this closes KN-22c, the spoofable rate-limit key).

## 3. DNS plan for `kiitnest.com` (zone contents to create before any nameserver change)

Everything currently in GoDaddy DNS is recreated in Route 53 **exactly**, so e-mail keeps working (see `DOMAIN-DISCOVERY-2026-10-09.md`):

| Keep exactly | `MX @ smtp.google.com. (1)`, `TXT @ google-site-verification=...`, `TXT @ v=spf1 include:dc-bdaca08905._spfm.kiitnest.com ~all` (to be extended for SES), `TXT dc-bdaca08905._spfm v=spf1 include:_spf.google.com ~all`, `TXT _dmarc ...` (quarantine), `CNAME _domainconnect` (optional) |
| Change | `A/AAAA @` and `www` become Route 53 alias records to the CloudFront distribution (replacing the GoDaddy parking page) |
| Add | SES DKIM CNAMEs (three), SES MAIL FROM records if used, ACM validation CNAMEs |

`kiitnest.in` is a second hosted zone with only the redirect records (A/AAAA aliases for `@` and `www` to the redirect distribution). It has no mail records today; confirm that this stays true.

## 4. Safe order of work (each step is its own approval where marked)

1. **Staging subdomain first.** Create a Route 53 hosted zone for `staging.kiitnest.com` and delegate it from GoDaddy by adding **NS records for `staging` only** (a small, reversible DNS change that cannot affect mail or the apex). Everything (ACM, CloudFront, WAF, EC2, RDS, SES test) is proven on a real HTTPS hostname before the main domain moves. *Approval needed: the NS delegation record.*
2. Create the production `kiitnest.com` and `kiitnest.in` zones **empty-but-complete** (all records of section 3 copied) and verify them by querying the Route 53 nameservers directly (`nslookup kiitnest.com <route53-ns>`), comparing every answer to GoDaddy's. *No live change yet.*
3. **Nameserver cutover** at GoDaddy to the four Route 53 nameservers per zone. This is the moment mail and the site depend on Route 53. Done only after step 2 matches exactly, TTLs lowered a day earlier, and the previous GoDaddy nameservers recorded for rollback (they are `ns43/ns44.domaincontrol.com`). *Approval needed: nameserver change (D1).*
4. Switch `@` and `www` aliases to CloudFront after the production origin passes staging. *Approval needed: production release (C1).*
5. DNSSEC: not enabled initially (a mistake can take the domain offline); revisit after stability.

## 5. Things in the earlier plan that change or conflict

- **Cloudflare Turnstile** is named in the contract (unverified copy) and in HD-06 inputs. AWS-native replacement: WAF CAPTCHA/Challenge. Whether KIIT accepts this substitution is a contract question for you; I will not change the contract.
- **GHCR private image + token (S1-2)** is replaced by **ECR + GitHub OIDC role**. That adds an IAM OIDC provider and a CI role scoped to pushing one repository.
- S-1 grows from compute + database to also test the edge on the staging subdomain (CloudFront + ACM + WAF + Route 53 + SES identity). That is a separate sandbox stage, **S-2**, after S-1.

## 6. Cost view (approximate, not verified against the AWS price list)

| Item | Per month, production |
|---|---|
| EC2 `t4g.small` + public IPv4 + EBS | about 20 |
| RDS `db.t4g.micro` Single-AZ + 20 GB (Multi-AZ doubles the instance part) | about 15 to 30 |
| Route 53: 2 hosted zones + low query volume | about 1 to 2 |
| CloudFront (low traffic) | about 0 to 5 |
| AWS WAF: 1 web ACL + a few rules + request charges | about 8 to 12 |
| SES, S3, ECR, CloudWatch, SSM, Budgets, CloudTrail (low volume) | about 3 to 8 |
| **Total** | **about 50 to 80** (earlier estimate without WAF/CloudFront/Route 53: 35 to 43) |

These are new recurring paid services: they need your approval and a production budget ceiling, separate from the USD 25 S-1 sandbox ceiling.

## 7. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| ARCH-1 | Approve this AWS-native architecture as the target (Route 53, ACM, CloudFront, WAF, EC2, RDS, S3, SES, ECR, SSM, CloudWatch, Budgets, CloudTrail) | Approve |
| ARCH-2 | Confirm the WAF CAPTCHA/Challenge substitution for Turnstile, or tell me KIIT requires Turnstile | Approve the substitution |
| ARCH-3 | ECR with a GitHub OIDC role instead of GHCR | Approve |
| ARCH-4 | Add an S-2 sandbox stage for the edge on a `staging.kiitnest.com` delegation, with the NS delegation record in GoDaddy | Approve |
| ARCH-5 | Indicative production budget (section 6) and a production ceiling to approve later, once S-1 and S-2 give real numbers | Defer the number until S-1 and S-2 results |
| DOM-1 | `kiitnest.com` main, `kiitnest.in` redirect | **Answered by the owner** |
| Still open | The scoped AWS identity (S-1-PREFLIGHT section 2), the budget alert e-mail, the extra teardown roles (S1-1), the privacy and terms approver (HD-06), the commercial document |
