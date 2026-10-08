# S-1 approval packet (request, not an action)

**Nothing in this document has been done.** It is the single, bundled request for the AWS side of S-1, so you can approve, change or refuse it in one decision. It builds on `S-1-SPEC.md` (the test list and pass criteria) and on read-only inspection of the account on 2026-10-08.

## 1. What I found in the account (read-only)

| Item | Finding |
|---|---|
| Account | `166...892`, session is the **root user** (profile `claude-deploy`, ap-south-1, temporary credentials). Root has MFA enabled. |
| Plan | **PAID, ACTIVE**, USD 100.00 credits remaining (`aws freetier get-account-plan-state`). Credits apply first, so S-1 is likely to cost nothing out of pocket. |
| Existing KNEST resources | S3 bucket `knest-media-<acct>` (created 2026-10-08 14:20 UTC, ap-south-1, all public access blocked, SSE-S3, versioning off, one 2-byte `healthcheck/test.txt`); IAM user `knest-app` with **one static access key** and policy `knest-media-rw` (allows only `s3:PutObject`/`s3:GetObject` on that bucket). Someone set these up today, before my session; I did not create or change them. |
| Everything else in ap-south-1 | 0 EC2, 0 RDS, 0 Amplify apps, 0 SES identities, 1 default VPC, 0 AWS Budgets |
| Not found | `setup-aws.ps1` is not on disk (Desktop, Downloads, Documents) or in any branch's history, so I could not review what created the above. |

Assessment of the pre-existing setup: sensible and least-privilege for media. Concerns: (1) a long-lived access key exists and the uncommitted local change to `src/server/storage/index.ts` is designed to use it (the target design uses an instance role, no stored key); (2) there is no documents bucket yet (the contract needs a separate private one); (3) no budget alert.

## 2. Decisions needed (one request)

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Whose account is this?** (HD-19: the contract says KNEST/KIIT-owned accounts.) S-1 is a disposable sandbox, so it can run here, but nothing built here can become production unless this is the KIIT-owned account or is migrated. | Confirm the owner in writing. Run S-1 here either way. |
| D2 | **Approve the S-1 resources below** (the bill of materials and teardown plan). | Approve. |
| D3 | **Spending ceiling for S-1** | **USD 25**, with alerts at 50/80/100%. Expected cost is about USD 9 per week (before credits). |
| D4 | **Who creates IAM objects?** S-1 needs one EC2 instance role. Creating roles requires IAM rights; the session is root. | Approve me creating exactly the objects in section 3 using this session, **then you replace root with a scoped role** before anything beyond S-1. I will not create IAM users or access keys. |
| D5 | **Image delivery.** The host must never build the image and Docker is not installed on this machine. | Build an arm64 image in GitHub Actions and publish it to GitHub's container registry (GHCR) as a public package (the repository is public and the image holds no secrets). No AWS credentials in CI, no ECR, no OIDC role. |
| D6 | **Budget alert recipient.** An AWS Budget e-mails an address. | Give me the address to use. (Sending to it counts as sending a message, so I need your OK.) |
| D7 | **SES check** (S-1 check 5). Needs one verified sender in SES sandbox, which sends one verification e-mail. | Skip in S-1; do it with the real domain later. |

## 3. Resources to create (all tagged `project=knest-s1`, `expires=<today+14d>`)

| Resource | Spec | Why | Est. cost / 7 days |
|---|---|---|---|
| VPC `knest-s1` | 10.20.0.0/16, 1 public subnet (EC2), 2 private subnets in two AZs (RDS needs two), internet gateway, route tables. **No NAT gateway.** | Private database; avoid a $40/month NAT | $0 |
| Security groups | EC2: **no inbound rules** (access by SSM Session Manager). RDS: inbound 5432 only from the EC2 group. | No exposed ports | $0 |
| EC2 `t4g.small` | Amazon Linux 2023 arm64, IMDSv2 required, 20 GB encrypted gp3, public IPv4 (outbound only) | The target host (2 GiB) | 1.9 + 0.4 + 0.8 = **$3.1** |
| EC2 `t4g.medium` (optional, about 8 hours) | Same image | Compare memory if 2 GiB fails | $0.2 |
| IAM role + instance profile `knest-s1-ec2` | `AmazonSSMManagedInstanceCore` + inline policy: S3 get/put on the S-1 test bucket only | SSM access; S3 without keys | $0 |
| RDS PostgreSQL 16 `db.t4g.micro` | Single-AZ, 20 GB gp3 encrypted, **not publicly accessible**, parameter group `rds.force_ssl=1`, 1-day backups, deletion protection off, no final snapshot | Private database, production-like | 3.5 + 0.6 = **$4.1** |
| S3 bucket `knest-s1-<acct>` | Private, all public access blocked, SSE-S3 | Presigned upload test | ~$0 |
| SSM Parameter Store (standard) | DB password and app secrets as SecureStrings; generated on the host, never printed | Secrets without chat or files | $0 |
| CloudWatch log group `/knest-s1` | 7-day retention | Container logs | <$0.5 |
| AWS Budget `knest-s1` | USD 25/month, alerts 50/80/100% | Cost guard (the account has none) | $0 |
| **Total** | | | **about $8 to $9 per week** (credits cover it) |

## 4. What S-1 will do (from `S-1-SPEC.md`, nothing beyond it)

1. Build the arm64 image in GitHub Actions from the reviewed branch; the host only pulls it.
2. Run the app, Payload admin and Auth.js against the private RDS with **synthetic data only**; migrations from empty via `pnpm migrate`.
3. Measure memory with **two containers overlapping during deployments** (5 consecutive deploys), under a 50-concurrent-user k6 run, with real database traffic and an authenticated admin session. Pass: combined peak at or below 75% of RAM, no swap-in, no OOM kill, p95 within 1.5x of steady state (proposed criteria; approve or change).
4. Presigned S3 upload with post-upload magic-byte check; sharp on arm64; `next/image`; cold restart under 60 s; blue/green with zero failed requests; rollback to the previous image; correct client-IP derivation (tested with a synthetic `X-Forwarded-For`/`CF-Connecting-IP`; Cloudflare itself is not in S-1).
5. Record pass/fail per check in `docs/delivery/EVIDENCE/S-1.md` with command output.

## 5. Teardown and rollback

Delete in reverse order: EC2 and instance profile/role, RDS (skip final snapshot), S3 test bucket (empty first), SSM parameters, log group, route tables/subnets/IGW/VPC, security groups, budget. Then re-run the read-only inventory and confirm only the pre-existing `knest-media-<acct>` bucket, the `knest-app` user and its policy remain, and check Cost Explorer the next day. Everything is created by one reviewed script with a matching teardown script, so nothing depends on memory.

## 6. What stays out of S-1

Production resources, DNS and domains (not supplied), Cloudflare, SES production access, any change to the existing bucket, user, key or policy, any real data, any deployment to Vercel.

## 7. Risks I am accepting only if you approve

- Using the root session for the creation steps (D4). Mitigation: only the listed objects, then root is set aside.
- Public IPv4 on the instance (outbound only; no inbound ports).
- A public GHCR package (D5). Mitigation: it contains no secrets; secrets arrive only at runtime from SSM.
