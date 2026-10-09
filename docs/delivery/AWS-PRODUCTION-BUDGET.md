# AWS production bill: ONE environment, Mumbai (ap-south-1), 2026-10-09

**Status: estimate for approval. Nothing is provisioned and nothing is charged.** Scope per the owner's final deployment decision: one production environment, no permanent staging. The disposable S-1 spike is budgeted separately (USD 25 ceiling, `S-1-PREFLIGHT.md`).

## How the numbers were obtained

"Source: AWS list" means the figure was read from AWS's public price list files on 2026-10-09 (`pricing.us-east-1.amazonaws.com`, the EC2 Mumbai calculator file, RDS Mumbai offer, WAF, CloudFront, ECR, Route 53). "Published rate" means a standard AWS list price I am confident of but did not extract from a file today; these are marked and must be re-checked in the AWS Pricing Calculator before provisioning. 730 hours per month. USD, before tax, before credits (the account shows USD 100 of credits; they reduce cash out but are not counted here).

## 1. Unavoidable base cost (does not depend on traffic)

| Item | Basis | USD / month | Source |
|---|---|---|---|
| EC2 `t4g.small` (2 vCPU, 2 GiB), on-demand | 0.0112 per hour | 8.18 | AWS list |
| Public IPv4 on the instance (outbound only) | 0.005 per hour | 3.65 | Published rate |
| EBS root volume 20 GB gp3 | about 0.09 per GB-month | 1.80 | Published rate |
| RDS PostgreSQL `db.t4g.micro`, Single-AZ | 0.021 per hour | 15.33 | AWS list |
| RDS storage 20 GB gp3 | 0.131 per GB-month | 2.62 | AWS list |
| RDS automated backups, 7 days (within the free allocation equal to storage) | 0 | 0.00 | Published rule |
| AWS WAF: 1 web ACL | 5.00 per month | 5.00 | AWS list |
| AWS WAF: 5 rules (3 managed groups + 2 rate-based) | 1.00 per rule per month | 5.00 | AWS list |
| Route 53: 2 hosted zones (`kiitnest.com`, `kiitnest.in`) | 0.50 per zone | 1.00 | Published rate |
| ECR: about 5 images retained, about 0.5 GB | 0.10 per GB-month | 0.05 to 0.30 | AWS list |
| Secrets Manager: RDS-managed master password (1 secret) | 0.40 per secret | 0.40 | Published rate |
| CloudWatch: 10 alarms, 7-day log retention, low log volume | 0.10 per alarm plus ingestion | 1.50 to 2.50 | Published rate |
| EBS snapshots (daily, 7 kept) | about 0.05 per GB-month | 0.50 | Published rate |
| S3 (documents, media, logs): a few GB | about 0.025 per GB-month | 0.25 to 1.00 | Published rate |
| ACM certificates (public) | free | 0.00 | Published rule |
| CloudTrail (first trail, management events), AWS Budgets (first 2), SNS (low volume), SSM, KMS AWS-managed keys | free at this scale | 0.00 | Published rule |
| **Base total** | | **about 40 to 43** | |

## 2. Traffic-dependent charges (zero at zero traffic)

| Item | Rate | Example |
|---|---|---|
| WAF requests | 0.60 per million requests | 5 million requests per month = 3.00 |
| CloudFront HTTPS requests (India) | 1.20 per million, **after** the free tier (10 million requests and 1 TB transfer per month, published always-free allowance) | below 10 million requests and 1 TB: 0 |
| CloudFront data out | per GB, after the free 1 TB | a content site of this kind stays inside the free allowance |
| Route 53 standard queries | 0.40 per million (queries to alias records are free) | about 0 |
| SES | 0.10 per 1,000 messages (published rate; check the current free allowance) | 10,000 messages per month = 1.00 |
| S3 requests and growth, CloudWatch log growth | small | under 2 |
| **Typical total at pilot scale** | | **about 3 to 8** |

## 3. Totals for ONE production environment

| Case | Compute | USD / month |
|---|---|---|
| Expected (S-1 confirms 2 GiB is enough) | `t4g.small`, Single-AZ RDS `db.t4g.micro` | **about 45 to 51** (base 40 to 43 plus traffic 3 to 8) |
| If S-1 shows 2 GiB is not enough | `t4g.medium` (0.0224 per hour = 16.35) | about +8.2 |
| If a failover database is required | RDS Multi-AZ doubles the instance part (+15.3) and storage (+2.6) | about +18 |

Removed by the owner's decision: a permanent staging instance (8.2 + 3.7 + 1.8), staging database (18), staging distribution and zone. That is **about USD 33 per month not spent** compared with a two-environment layout.

## 4. The origin-networking comparison (the owner asked for this)

| Option | Security | Extra monthly cost | Notes |
|---|---|---|---|
| **A. EC2 in a public subnet, inbound allowed only from CloudFront** (managed prefix list, plus a secret origin header the app checks) | Good: no database exposure; origin bypass blocked by the security group and the header | 0 (the public IPv4 is already in the base) | Outbound to SES, ECR, SSM, Turnstile and Google works through the internet gateway. |
| **B. CloudFront VPC origin with EC2 in a private subnet** | Strongest: the instance has no public address at all | **NAT gateway about 0.056 per hour + data = about 41 to 45** (published rate), **or** interface endpoints for SSM (3), ECR (2), Secrets Manager, CloudWatch Logs at about 7 to 8 each = about 40 to 56; and Turnstile, Google OAuth and SES (SMTP) still need internet egress, i.e. a NAT | Roughly doubles the bill for a marginal security gain over A with a correct security group and header check. |

**Recommendation: A for launch**, with the verification that B would add (origin-bypass test from the open internet, security group review). The S-1 edge test (section 5 of `S-1-PREFLIGHT.md`) will exercise both on a CloudFront default hostname so the choice rests on a demonstrated result, as the owner requires. This is the lowest-cost secure and maintainable option unless S-1 shows A cannot be locked down.

## 5. Cost levers that do not weaken security

- After S-1, buy a 1-year commitment (EC2 Savings Plan / RDS reserved) only if the owner wants it: typically about 30 percent off those two lines (about 7 per month). Not recommended before the system is proven.
- Keep WAF at 5 rules; each extra rule is 1 per month.
- Evaluate CloudFront's flat-rate plans (they may bundle WAF and DNS at a fixed price). Not evaluated; must be checked against the current AWS page before relying on it.
- Do not remove RDS backups, the private database subnet, WAF, or CloudTrail to save money.

## 6. Guardrails once approved

AWS Budgets: a monthly budget at 60, with alerts at 50, 80 and 100 percent plus a forecast alert, to the address the owner supplies (still not provided). A Budget does not stop spending by itself; the cost-watch procedure in `S-1-PREFLIGHT.md` section 4 applies to production too.

## 7. What the owner is asked to approve (later, with the release manifest)

1. The expected monthly bill of about USD 45 to 51 (range 40 to 70 including the S-1 outcomes in section 3), and a production ceiling (suggested USD 75 per month).
2. Single-AZ RDS with 7-day automated backups for launch (Multi-AZ later if the institution wants it).
3. Option A for origin networking, unless S-1 shows otherwise.
