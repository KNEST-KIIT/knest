# Cost-Optimized AWS Production Deployment Plan (Mumbai `ap-south-1`)
**Date**: 2026-10-27  
**Scope Contract**: Full Commercial Multi-Module Release (Accounts, Dashboards, Applications, Events, Labs, QR Attendance, Ecosystem, Enquiries)  
**Status**: Rigorous Engineering Plan & Architecture Specification (No cloud mutations or deployments authorized in this phase)

---

## 1. Cloud Infrastructure Inventory: Verified Facts vs. Inferences & Gaps

### A. Fresh Verified Facts (Observed in Brave Console & GoDaddy, 2026-10-27)
1. **EC2 Compute Instance (`ap-south-1a`)**:
   - Instance ID: **`i-0dbccc58bd903416e`**.
   - State: **Stopped** (temporarily halted under October 18 root exception to prevent idle burn).
   - Instance Type: **`t4g.small`** (ARM64 Graviton2, 2 vCPU, 2 GiB RAM).
   - Availability Zone: **`ap-south-1a`**.
   - Official Console On-Demand Quote: **$0.0112 / hour** ($8.176 / 730-hour month).
   - T4g CPU Surplus Credit Rate: **$0.04 per vCPU-hour** (verified at `aws.amazon.com/ec2/pricing/on-demand/` for Linux).
2. **Live Amazon RDS PostgreSQL Database (`ap-south-1b`)**:
   - DB Identifier: **`knest-production-app-database-qnuuhlcafmbh`**.
   - State: **Available**.
   - Engine: **PostgreSQL 16.11**.
   - Instance Class: **`db.t4g.micro`** (2 vCPU, 1 GiB RAM, Graviton2).
   - Availability Zone: **`ap-south-1b`** (Single-AZ).
   - Storage: **20 GiB gp3** ($0.1310 / GB-month = $2.62 / month).
   - Encryption: **Enabled** using default AWS-managed KMS key **`aws/rds`**.
   - Deletion Protection: **Enabled**; Autoscaling: **Disabled**.
   - Automated Backups: **7-day retention**; Latest restore: **October 27, 2026, 11:37 IST**; **13 snapshots** retained.
   - **Cross-AZ Traffic Reality**: Because EC2 host sits in `ap-south-1a` while RDS sits in `ap-south-1b`, database queries traverse Availability Zone boundaries. AWS bills cross-AZ data transfer at **$0.01 / GB in each direction ($0.02 / GB round-trip)**.
   - **AZ Migration Reality**: An EC2 instance **cannot move availability zones by a restart**. Migrating `i-0dbccc58bd903416e` from `ap-south-1a` to `ap-south-1b` requires creating an AMI, updating CloudFormation subnet parameters, and recreating the instance in subnet `ap-south-1b`.
3. **Amazon SES (Mumbai `ap-south-1`) & GoDaddy DNS**:
   - Environment State: **Sandbox Mode** (max 200 emails/day, max 1 email/second; restricted to verified recipient identities or mailbox simulator).
   - Domain Status: `kiitnest.com` is **Unverified** in SES console; DKIM status is currently **Error / awaiting detection and retry**.
   - **GoDaddy Update**: All **three SES DKIM CNAME records are now SAVED in GoDaddy**; 17 DNS records verified; original Google Workspace MX record (`smtp.google.com`, Priority 1) is active and retained.
   - Once AWS SES re-detects the saved DKIM records, a production access request must be submitted in the AWS SES Console to exit sandbox mode.
4. **GoDaddy Registrar & Identity State**:
   - `kiitnest.com`: Live, 17 records verified, Google email active.
   - `kiitnest.in`: Active Registrar Hold displayed live in GoDaddy due to pending WHOIS contact verification (still pending verification after refresh despite owner statement).
   - AWS Console Session: AWS "My security credentials" explicitly displays **Root user**; operator requested again to use a properly scoped IAM session. No cloud mutations executed by assistant.
5. **US-East-1 (`us-east-1`) Edge Stacks**:
   - `knest-production-edge`: **CREATE_COMPLETE**.
   - `knest-production-waf`: **CREATE_COMPLETE**.
   - `knest-production-cert`: **ROLLBACK_FAILED** (timed-out cert `c49fe3e8-cbc9-4f4b-8aee-2ce405658e31`; not in use).
6. **Mumbai (`ap-south-1`) Stacks**:
   - `knest-production-app`: **UPDATE_ROLLBACK_COMPLETE** (Oct 11 SSM `DeployDocument` replacement conflict; local template `infra/cfn/app.yaml` already has `UpdateMethod: NewVersion` configured).
   - `knest-production-origin`: **CREATE_COMPLETE**; `knest-production-ses`: **CREATE_COMPLETE**; `knest-production-ci`: **UPDATE_COMPLETE**; `knest-production-parking`: **REVIEW_IN_PROGRESS**.
7. **Billing & Budget Observations**:
   - MTD Spend: **USD 25.19**; Month-end gross forecast: **USD 34.01**.
   - Budget displays USD 0 actual spend / USD 8.83 forecast. Active promotional credits appear to be offsetting billed items; remaining credit balance and expiration dates remain unverified.

---

## 2. Infrastructure as Code (IaC) Component Audit & Cost Mapping

To ensure absolute fidelity to the repository's CloudFormation templates, all cost components are derived directly from `infra/cfn/app.yaml`, `origin.yaml`, and `waf.yaml`:

### A. Secrets Manager Secrets (Matched to `infra/cfn/app.yaml`)
`infra/cfn/app.yaml` explicitly declares **FIVE** Secrets Manager secret resources, plus **ONE** RDS-managed master secret:
1. `OriginVerifySecret` (`AWS::SecretsManager::Secret`, line 310)
2. `DbRuntimeSecret` (`AWS::SecretsManager::Secret`, line 323)
3. `AuthSecret` (`AWS::SecretsManager::Secret`, line 335)
4. `PayloadSecret` (`AWS::SecretsManager::Secret`, line 340)
5. `TurnstileSecret` (`AWS::SecretsManager::Secret`, line 347)
6. `Database.MasterUserSecret.SecretArn` (RDS Managed Master Password Secret, line 262/404)
- Sourced Rate (`ap-south-1`): **$0.40 / secret-month** + $0.05 per 10,000 API calls.
- Total Secrets Cost: 6 secrets × $0.40 = **$2.40 / month** (plus ~$0.10 in API calls = **$2.50 / month**).

### B. CloudWatch Alarms (Matched to `app.yaml` & `origin.yaml`)
`infra/cfn/app.yaml` and `origin.yaml` explicitly declare **FIVE** alarms (4 in `app.yaml`, 1 in `origin.yaml`):
1. `EmailDeadAlarm` (`AWS::CloudWatch::Alarm`, `app.yaml:670`)
2. `HostStatusAlarm` (`AWS::CloudWatch::Alarm`, `app.yaml:684`)
3. `DbCpuAlarm` (`AWS::CloudWatch::Alarm`, `app.yaml:698`)
4. `DbStorageAlarm` (`AWS::CloudWatch::Alarm`, `app.yaml:711`)
5. `HealthyTargetsAlarm` (`AWS::CloudWatch::Alarm`, `origin.yaml:104`)
- Sourced Rate (`ap-south-1`): **$0.10 / alarm-month** (standard 1-minute resolution).
- Total Alarms Cost: 5 alarms × $0.10 = **$0.50 / month**.
- CloudWatch Log Ingestion: ~1.5 GB @ $0.50/GB = **$0.75 / month**.
- Total CloudWatch: **$1.25 / month**.

### C. AWS WAF WebACL (Matched to `infra/cfn/waf.yaml`)
`infra/cfn/waf.yaml` explicitly declares **THREE** AWS Managed Rule Groups and **TWO** Rate-Based Rules:
1. `CommonRuleSet` (`AWSManagedRulesCommonRuleSet`, line 36)
2. `KnownBadInputs` (`AWSManagedRulesKnownBadInputsRuleSet`, line 53)
3. `IpReputation` (`AWSManagedRulesAmazonIpReputationList`, line 64)
4. `RateLimitAuth` (Rate-based rule on `/api/auth/`, limit 100/5min, line 75)
5. `RateLimitGlobal` (Rate-based rule global, limit 2000/5min, line 94)
- Sourced Rate (`us-east-1` CloudFront Scope): **$5.00 / WebACL-month** + **$1.00 / managed rule group-month** (3 groups = $3.00) + **$0.60 per 1M requests**.
- Total WAF Fixed Cost: $5.00 + $3.00 = **$8.00 / month** (plus ~$0.60/1M requests = **~$8.60 / month**).

### D. Compute, Storage & Public IPv4 (Matched to `infra/cfn/app.yaml`)
- `AppInstance` (`app.yaml:470`): Deployed in `PublicSubnet` (`app.yaml:478`).
- Root Volume: **20 GiB gp3** (`app.yaml:484`, VolumeSize: 20) @ $0.08/GB-month = **$1.60 / month**.
- Public IPv4 Charges (730h × $0.005/IP-hour):
  - EC2 host in `PublicSubnet`: 1 public IPv4 address = **$3.65 / month**.
  - ALB spans 2 public subnets allocating 2 public IPv4 addresses: 2 × 730h × $0.005 = **$7.30 / month**.
  - Total Public IPv4: **3 public IPv4 addresses = $10.95 / month**.
- Private Subnet Alternative Evaluation:
  - If EC2 were placed in a private subnet, outbound internet traffic (for Docker pulls, security patches, AWS API calls) would require either:
    - AWS NAT Gateway: **$0.045 / hour ($32.85 / month)** + $0.045 / GB data processing.
    - VPC Interface Endpoints (ECR API, ECR DKR, S3 Gateway, SSM, SecretsManager): 4 interface endpoints @ $0.01/hr = **$29.20 / month**.
  - Conclusion: Deploying EC2 in `PublicSubnet` with Security Group restricting inbound traffic strictly to ALB (or CloudFront prefix list) saves $20–$30/month while maintaining strict network security.

### E. ECR, Backup, Archive & Recovery
- Amazon ECR: Storage for 3 immutable release image tags (~1.5 GB each = 4.5 GB) @ $0.10/GB-month = **$0.45 / month**.
- RDS Automated Backups: 7-day retention of 20 GiB database included in DB cost up to 100% of allocated storage ($0.00 additional).
- Manual RDS Pre-Deployment Snapshots: 13 existing snapshots (~260 GB cumulative compressed delta) @ $0.095/GB-month = **$2.47 / month** (UNVERIFIED until consolidated).
- S3 Document Storage & Glacier Archive: Active documents (~5 GB) @ $0.023/GB = $0.12/mo; Glacier Deep Archive transitions @ $0.002/GB = $0.05/mo. Applicant documents now sit in a dedicated clean bucket that archives to Deep Archive at 1,827 days and never expires current versions (section 6); the quarantine bucket holds only unscreened or rejected files for at most 14 days and costs effectively nothing.

---

## 3. Financial Models: Conservative Gross Model vs. Confirmed Allowance Model

### Official Sourced Regional Rates (`ap-south-1` Mumbai)

| Component | Source / Schedule | Regional Sourced Rate (`ap-south-1`) | Monthly Basis (730h) | Status |
|---|---|---|---|---|
| **EC2 `t4g.small`** | `aws.amazon.com/ec2/pricing/on-demand/` | **$0.0112 / hour** (ARM64, 2 vCPU, 2 GiB RAM) | **$8.18 / month** | SOURCED |
| **EC2 `t4g.medium`** | `aws.amazon.com/ec2/pricing/on-demand/` | **$0.0224 / hour** (ARM64, 2 vCPU, 4 GiB RAM) | **$16.35 / month** | SOURCED |
| **T4g CPU Surplus** | `aws.amazon.com/ec2/pricing/on-demand/` | **$0.0400 / vCPU-hour** (Linux on-demand surplus) | **$0.00** (Base) / **$3.50** (Burst) | SOURCED |
| **EBS Root Storage** | `infra/cfn/app.yaml:484` | **$0.0800 / GB-month** (20 GiB gp3 root) | **$1.60 / month** | SOURCED |
| **ALB Base** | `aws.amazon.com/elasticloadbalancing/pricing/` | **$0.0239 / hour** (Mumbai regional rate) | **$17.45 / month** | SOURCED |
| **ALB Capacity (LCU)** | `aws.amazon.com/elasticloadbalancing/pricing/` | **$0.0080 / LCU-hour** (1.0 LCU baseline) | **$5.84 / month** | SOURCED |
| **Public IPv4** | `aws.amazon.com/vpc/pricing/` | **$0.0050 / IP-hour** (3 IPs: 2 ALB + 1 EC2) | **$10.95 / month** | SOURCED |
| **RDS PostgreSQL 16** | `aws.amazon.com/rds/postgresql/pricing/` | **$0.0210 / hour** (`db.t4g.micro`, Single-AZ) | **$15.33 / month** | SOURCED |
| **RDS gp3 Storage** | `aws.amazon.com/rds/postgresql/pricing/` | **$0.1310 / GB-month** (20 GiB allocated) | **$2.62 / month** | SOURCED |
| **Cross-AZ Traffic** | `aws.amazon.com/ec2/pricing/on-demand/` | **$0.0200 / GB round-trip** (EC2 in 1a, RDS in 1b) | **$0.60 / month** (~30 GB) | SOURCED |
| **AWS Secrets Manager** | `infra/cfn/app.yaml` | **$0.40 / secret-month** (6 secrets: 5 app + 1 RDS master) | **$2.50 / month** | SOURCED |
| **CloudWatch Alarms & Logs** | `infra/cfn/app.yaml` & `origin.yaml` | **5 alarms** ($0.50) + Log ingestion ($0.75) | **$1.25 / month** | SOURCED |
| **AWS WAF** | `infra/cfn/waf.yaml` | **$5.00 WebACL + 3 Managed Groups ($3.00) + requests** | **$8.60 / month** | SOURCED |
| **Route 53** | `aws.amazon.com/route53/pricing/` | **$0.50 / hosted zone** (2 zones: `.com`, `.in`) | **$1.00 / month** (CF queries free) | SOURCED |
| **CloudFront CDN** | `aws.amazon.com/cloudfront/pricing/` | Always-free 1 TB / 10M requests account-wide. Excess: $0.109/GB. | **$0.00** (Allowance) / **$2.50** (Gross) | SOURCED |
| **Amazon S3 Standard** | `aws.amazon.com/s3/pricing/` | **$0.023 / GB-month** (~5 GB active uploads + requests) | **$0.20 / month** | SOURCED |
| **Amazon SES** | `aws.amazon.com/ses/pricing/` | **$0.10 per 1,000 emails** sent | **$0.20 / month** (~2,000 emails) | SOURCED |
| **Amazon ECR & Snapshots** | `aws.amazon.com/ecr/pricing/` | Image storage (~4.5 GB) + snapshot storage delta | **$2.92 / month** | UNVERIFIED |
| **Document screening** (GuardDuty Malware Protection for S3, KMS key, SQS, alarms, 5-year hot logs) | `infra/cfn/app.yaml`; GuardDuty rates as published for US East (reference) | $0.09/GB scanned + $0.215/1,000 objects; $1.00 per key-month; 7 alarms; see "Document screening and retention line items" below | **$3.72 to $4.08 / month** (cohort-rush month) | Mumbai GuardDuty rate UNVERIFIED |

---

### Monthly Financial Comparison (730 Hours, Pre-Credit)

| Component | Model A: Conservative Gross | Model B: Confirmed Allowance | High-Load / Active Cohort |
|---|---|---|---|
| **EC2 Compute (`t4g.small` / `t4g.medium`)** | $8.18 | $8.18 | $16.35 |
| **T4g CPU Surplus Credits ($0.04/vCPU-hr)** | $0.00 | $0.00 | $3.50 |
| **EBS Root Storage (20 GiB gp3)** | $1.60 | $1.60 | $2.40 |
| **Application Load Balancer (Base + LCU)** | $23.29 | $23.29 | $32.05 |
| **Public IPv4 Addresses (3 IPs)** | $10.95 | $10.95 | $10.95 |
| **RDS PostgreSQL (`db.t4g.micro` + gp3)** | $17.95 | $17.95 | $33.28 (`db.t4g.small`) |
| **Cross-AZ Data Transfer (EC2 1a ↔ RDS 1b)** | $0.60 | $0.60 ($0 if colocated in 1b) | $1.50 |
| **Secrets Manager (6 secrets)** | $2.50 | $2.50 | $3.00 |
| **CloudWatch Alarms (5) & Logs** | $1.25 | $1.25 | $2.50 |
| **AWS WAF (WebACL + 3 Managed Groups)** | $8.60 | $8.60 | $10.50 |
| **Route 53 (2 zones; CF queries free)** | $1.20 | $1.00 (CF queries waived) | $1.20 |
| **CloudFront CDN** | $2.50 | $0.00 (Covered by 1 TB free tier) | $2.50 |
| **S3, SES, ECR & Snapshots** | $3.32 | $3.32 | $5.50 |
| **Document screening + 5-year hot logs** (line items below) | $4.08 | $3.72 | $12.70 |
| **TOTAL MONTHLY COMMITMENT (USD)** | **$86.02 / month** | **$82.96 / month** | **$137.93 / month** |

*Revised 2026-10-28.* The previous totals ($81.94, $79.24, $137.23) carried the document-screening line at $0.00 or $12.00 "if added"; that line is now a designed, templated component. Every other row is unchanged and still sums to the previous totals.

### Document screening and retention line items (monthly, reference rates)

Scenarios: Model A and B are a cohort-rush month of 5,000 uploads averaging 2 MB (10 GB scanned); the high-load column is 20,000 uploads averaging 3 MB (60 GB). GuardDuty rates are those published for US East (N. Virginia) on 2026-10-27; **the Mumbai rate is not published on the page and is UNVERIFIED**. Model B applies the published monthly free tier (1,000 requests and 1 GB); Model A does not.

| Line | Model A | Model B | High-load | Basis |
|---|---|---|---|---|
| GuardDuty scanning: data | $0.90 | $0.81 | $5.40 | $0.09 per GB scanned |
| GuardDuty scanning: objects | $1.08 | $0.86 | $4.30 | $0.215 per 1,000 objects evaluated |
| Customer-managed KMS key | $1.00 | $1.00 | $1.00 | one key for both document buckets; S3 Bucket Keys keep request charges negligible |
| SQS (results queue and dead-letter queue) | $0.05 | $0.00 | $0.40 | long polling stays inside the free tier |
| Seven screening alarms | $0.70 | $0.70 | $0.70 | $0.10 per alarm-month; the account free tier is not applied |
| S3 tagging and copy requests | $0.05 | $0.05 | $0.30 | small at this volume |
| Hot logs kept five years (year one) | $0.30 | $0.30 | $0.60 | CloudWatch storage grows each year the 1,827-day retention holds logs; about the same again per year, so roughly $1.50 to $2.70 per month at steady state (rate unverified for Mumbai) |
| **Total** | **$4.08** | **$3.72** | **$12.70** | Model A: $0.90 + $1.08 + $1.00 + $0.05 + $0.70 + $0.05 + $0.30 (the objects line is $1.075, rounded in the table) |

EventBridge delivery of AWS-service events on the default bus, the two plan-health rules and the SQS dead-letter queue add no material cost. A sustained day at the volume-alarm threshold (5 GiB per day) would cost about $13.50 a month in scanning, which is what that alarm exists to catch.

---

## 4. Architectural Deep-Dive: CloudFront Direct to EC2 vs. ALB+RDS

The owner requested the lowest possible reliable run rate. We rigorously evaluate replacing the ALB with direct CloudFront-to-EC2 HTTPS while retaining AWS WAF and RDS:

```
Option 1: Existing Baseline (Recommended)
[Client] ──> [CloudFront + WAF] ──(HTTPS/ACM)──> [ALB in 2 AZs] ──(HTTP)──> [EC2 (Docker)] ──> [RDS 16 in 1b]
Cost Overhead: +$23.29 (ALB Base+LCU) + $7.30 (2 ALB IPv4s) = ~$30.59/mo.

Option 2: CloudFront Direct to Public EC2
[Client] ──> [CloudFront + WAF] ──(HTTPS/Let's Encrypt)──> [EC2 Public Subnet] ──> [RDS 16 in 1b]
Gross Savings: -$30.59/mo. Operational Debt: Certbot auto-renewal, Nginx reverse proxy overhead on 2GB RAM.

Option 3: CloudFront VPC Origin to Private EC2
[Client] ──> [CloudFront + WAF] ──(VPC Origin $7.30/mo)──> [Private EC2] ──(NAT Gateway $32.85/mo!)──> [RDS]
Net Cost: MORE EXPENSIVE (+ $40/mo for NAT Gateway & endpoints).
```

### Detailed Evaluation Matrix:

| Dimension | Baseline Architecture (CloudFront -> ALB -> EC2 + RDS) | Direct CloudFront to Public EC2 (Bypassing ALB) | CloudFront VPC Origin to Private EC2 |
|---|---|---|---|
| **ALB Base & LCU Cost** | $23.29 / month | **$0.00** (Eliminated) | $0.00 (or $17.45 if internal ALB) |
| **Public IPv4 Allocation** | 3 IPs ($10.95/mo: 2 ALB + 1 EC2) | **1 IP** ($3.65/mo: EC2 only; saves $7.30) | 0 public IPs on EC2 |
| **Outbound Connectivity (NAT / Endpoints)** | **$0.00** (EC2 uses Internet Gateway) | **$0.00** (EC2 uses Internet Gateway) | **+$32.85/mo for NAT Gateway** (or +$29.20 for VPC endpoints) |
| **VPC Origin Hourly Fee** | $0.00 | $0.00 | **+$7.30/mo** ($0.01/hr per VPC origin) |
| **Origin TLS Certificate** | **Free AWS ACM Managed** (auto-renewed by AWS on ALB listener; zero maintenance) | **Let's Encrypt / Certbot** on EC2 host (ACM cert cannot be exported to EC2; renewal script maintenance required) | Custom private PKI / self-signed or Let's Encrypt |
| **Direct-Origin Denial** | ALB Listener rule blocks all requests lacking `X-Origin-Verify` secret | EC2 host reverse proxy (Nginx) must enforce `X-Origin-Verify` header & CloudFront prefix list | Security group scoped to VPC origin interface |
| **Host Memory Impact** | Zero (ALB handles TLS termination & buffering) | Reverse proxy (Nginx/Caddy) consumes ~60–100 MB RAM on 2 GB `t4g.small` | Minor |
| **Zero-Downtime Rollout** | ALB target group connection draining | Direct connection drops during container restart | VPC origin target group |
| **Net Financial Impact** | Baseline ($82.96/mo net, Model B with document screening) | **Saves ~$30.59/mo ($52.37/mo net)** | **Increases cost by +$9.50 to +$25.00/mo** |
| **Architectural Verdict** | **RECOMMENDED**: Reliable, automated ACM TLS, zero Certbot operational debt, native health checks. | Viable *only* if owner accepts manual Certbot renewal risk and host reverse proxy maintenance. | **REJECTED**: NAT Gateway fee ($32.85) negates all savings. |

---

## 5. Security & Malware Scanning: Implemented Design

**Status (2026-10-28): implemented in the repository and verified locally against test doubles; hosted proof is Phase 2 work.** The fail-closed pipeline is described in [MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md](MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md). It replaces the earlier synchronous design (a scanner called before `putFile`) and its loopback test stub, which have been removed. The earlier statement that hosted scanning was "blocked, nothing provisioned" described the repository before this work; the resources now exist in `infra/cfn/app.yaml` but **nothing has been deployed or run in AWS**.

### A. Why the design is asynchronous and quarantine-first

GuardDuty Malware Protection for S3 scans an object *after* it lands in S3 and publishes the result through EventBridge; it offers no synchronous pre-upload endpoint (`docs.aws.amazon.com/guardduty/latest/ug/`, pages listed in the architecture document). The pipeline therefore never exposes an unscanned object:

1. Uploads land in a private, versioned quarantine bucket. A bucket policy denies every read unless that exact version carries `GuardDutyMalwareScanStatus: NO_THREATS_FOUND` (only GuardDuty's role is exempt), and only GuardDuty may write that tag.
2. GuardDuty scans each version and publishes a result; an EventBridge rule delivers it to an SQS queue (with a dead-letter queue) that the application polls over its instance role.
3. Only a "completed, no threats" result that matches the upload's bucket, key, version and ETag, whose tag agrees, makes the application copy exactly that version into a separate clean bucket and record `clean` in the database. Pending files answer HTTP 423, rejected files 404, and submission is blocked until every required document is clean.
4. Skipped, unsupported, failed, late or unrecognised results end in a rejected state; a sweeper fails anything still pending after 30 minutes.

### B. What it adds to the AWS bill

One GuardDuty Malware Protection plan on the quarantine bucket (no GuardDuty detector or other protection plan is enabled), one customer-managed KMS key, two S3 buckets, one SQS queue plus a dead-letter queue, three EventBridge rules, and seven alarms; line items are in section 3. **No larger instance is needed**: nothing scans on the host, and the verdict worker is an in-process polling loop.

### C. Rejected alternative: a ClamAV sidecar on the EC2 host

A ClamAV daemon holds an 800 MB to 1 GB signature database in memory, so the host would have to move from `t4g.small` to `t4g.medium` (+$8.18 per month), and the team would own signature updates, patching and scanner uptime, with the same asynchronous-promotion design still needed to avoid serving unscanned files. The managed service costs about $2 a month in a cohort-rush month at the reference rate and removes that operating burden. Revisit only if GuardDuty proves unavailable in the Region or its Mumbai price proves materially higher.

### D. Cost levers and what is still unverified

The 10 MB upload limit and type allow-list; exactly one plan and one protected bucket; a 14-day quarantine expiry; and a daily-bytes alarm (`ScanVolumeAlarmBytesPerDay`, default 5 GiB, about 500 uploads of the maximum size). **The Mumbai GuardDuty rate is not published** on the pricing page checked on 2026-10-27, so the US East rate is used as a reference and the alarm bounds exposure. The Phase 2 change set and hosted drill (architecture document, section 12) are the first points at which price, plan creation and real detection are observed.

---

## 6. Data Retention Policy: Five Years, Then Approved Backup and Archive

- **Policy (owner):** records and information are retained for 5 years, after which they are transferred to an approved backup and archive in line with KIITNEST's approved record management and archiving procedures (published at `/privacy`, "Retention and deletion"). This replaces the earlier ten-year wording. The five-year rule is an **owner policy commitment, not an independently established statutory mandate**; where law or a legal hold requires another treatment, the law prevails (the policy says so). The earlier version of this section proposed *expiring* records at day 1,827; that contradicts "then backup" and has been removed.
- **No S3 Object Lock in Compliance Mode.** It creates irreversible locks that not even the root user can remove, and it is rejected here. (Lifecycle rules have no "Governance mode"; that term belongs to Object Lock and is not used.)
- **Implemented in the template, not deployed** (`infra/cfn/app.yaml`):
  - **Applicant documents** (clean bucket): current versions stay in S3 Standard for 1,827 days (`ArchiveDocumentsAfterDays`), then move to **S3 Glacier Deep Archive**. Nothing is expired. Superseded versions are kept 90 days for recovery. Objects under 128 KB are included (`TransitionDefaultMinimumObjectSize: varies_by_storage_class`; AWS otherwise skips small objects).
  - **Application logs**: CloudWatch retention is 1,827 days (it was 7). CloudWatch only expires logs; **no export pipeline exists**, so archiving logs before they expire is separate, unbuilt and uncosted work.
  - **Quarantine** is not a record store: files are removed after 14 days.
  - **Database and recovery backups**: the database stays in PostgreSQL with seven-day rolling backups; those backups do not replace the archive.
- **Costs and limits of Deep Archive** (AWS S3 documentation): about $0.002 per GB-month at the reference rate; 40 KB of overhead per archived object (8 KB billed at Standard rates, 32 KB at Deep Archive rates); a 180-day minimum storage duration; a billed request per transition; retrieval is not real time (restore first, typically within 12 hours for standard retrieval and 48 hours for bulk) and carries retrieval charges. Restore must be rehearsed with a synthetic object before anyone relies on it. Hot logs kept five years add roughly $0.30 a month in year one and grow by about the same each year (section 3).
- **Still the owner's to decide:** the approved archive destination (the in-account Deep Archive rule is a proposal), the retention clock (creation, last activity or decision), legal-hold handling, who may retrieve, and the log export design. See [RETENTION-ASSURANCE-2026-10-17.md](RETENTION-ASSURANCE-2026-10-17.md).

---

## 7. Migration, Deployment & Rollback Realities

1. **EC2 Availability Zone Migration**:
   - Live instance `i-0dbccc58bd903416e` is in `ap-south-1a`. Live RDS is in `ap-south-1b`.
   - EC2 cannot move AZ by a restart. Migrating to `ap-south-1b` requires:
     1. Create AMI of `i-0dbccc58bd903416e`.
     2. Update CloudFormation stack parameters to assign `PublicSubnet` to `ap-south-1b`.
     3. Launch new instance from AMI in `ap-south-1b`.
     4. Register new instance with target group and terminate old instance.
2. **Rollback Mechanisms & Gates**:
   - Rollback is managed via SSM Document `knest-${Environment}-deploy` (`UpdateMethod: NewVersion`), deploying strictly by immutable image digest (`sha256:...`).
   - Claiming "< 60 seconds" rollback without an operational drill is unverified. Realistic rollback duration is **2 to 5 minutes** (Docker pull from ECR, container recreation, health check stabilization).
3. **Pre-Deployment Snapshot**:
   - Live RDS instance `knest-production-app-database-qnuuhlcafmbh` has continuous 7-day automated backups and 13 manual snapshots.
   - A fresh manual snapshot must be captured immediately before applying database migrations.
4. **Scoped Operator IAM (Zero Root Policy)**:
   - Root credentials must never be used for deployments.
   - All operations must proceed under a scoped IAM role with least-privilege policies.
