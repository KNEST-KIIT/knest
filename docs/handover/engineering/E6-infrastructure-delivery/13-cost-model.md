# E6.13 Cost model

Sources: `docs/delivery/AWS-PRODUCTION-BUDGET.md` (dated 2026-10-09, before the load balancer was added), `docs/delivery/ROLLOUT-PLAN-AND-BILLING.md` (2026-10-11), `V1-DEPLOYMENT-REPORT.md:79-80`, `infra/budget/*.json`, and the resource counts in the templates. All figures are planning estimates from list prices in ap-south-1 and us-east-1, not invoices (`ROLLOUT-PLAN-AND-BILLING.md:5`). No AWS Cost Explorer or invoice was available to this volume; no actual bill is recorded in the repository.

## 1. The four published figures and why they differ

| Document | Figure (USD/month) | What it includes |
|---|---|---|
| `AWS-PRODUCTION-BUDGET.md:47` | about 45-51 (base 40-43 plus traffic 3-8) | one `t4g.small`, one Single-AZ `db.t4g.micro`, WAF, two zones; **no load balancer** |
| `AWS-PRODUCTION-BUDGET.md:63` | about 65-76 "if" origin TLS needs an ALB | adds ALB 18-25 |
| `V1-DEPLOYMENT-REPORT.md:80` | about 65-76 | same, restated after the ALB was built |
| `ROLLOUT-PLAN-AND-BILLING.md:52-71` | about 70-95, plan 75-80, ceiling 100 | adds public IPv4 charges, six-plus secrets and a replica, realistic WAF and CloudWatch |

The first figure is not the cost of the deployed architecture; the ALB is not optional given `edge.yaml`'s production rule (`edge.yaml:69-76`). `RUNBOOK.md:310` warns of this and still quotes 45-51. The actual AWS Budget is USD 100 (`infra/budget/budget.json:3`), not the USD 60/75 suggested in the budget document (`AWS-PRODUCTION-BUDGET.md:76`, `:80`); `RUNBOOK.md:269` still says the budget amount is unapproved. Use the ROLLOUT figures.

## 2. Reconstruction from the templates

Unit rates are taken from the repository's own tables (730 h per month, USD). The resource counts come from the templates. This is a check of the documents' arithmetic, not a measured bill.

| Line | Driver in the templates | Unit | Low | High |
|---|---|---|---|---|
| EC2 `t4g.small` | `app.yaml:466-494`, one on-demand instance | 0.0112/h | 8.18 | 8.18 |
| Public IPv4 | instance (`MapPublicIpOnLaunch`) plus one per ALB subnet, 3 | 0.005/h each | 10.95 | 10.95 |
| EBS 20 GB gp3 | `app.yaml:480-481` | 0.09/GB | 1.80 | 1.80 |
| RDS `db.t4g.micro` Single-AZ | `app.yaml:246-272` | 0.021/h | 15.33 | 15.33 |
| RDS storage 20 GB gp3 | `DbAllocatedStorageGb` | 0.131/GB | 2.62 | 2.62 |
| ALB | `origin.yaml:68-76` | 0.025/h + LCU | 18.00 | 25.00 |
| WAF | 1 ACL (5.00) + 5 rules (5.00) + requests (0.60 per million) | | 10.00 | 13.00 |
| Route 53 | 2 zones, if `dns.yaml` is deployed | 0.50 | 1.00 | 1.00 |
| Secrets Manager | 5 template secrets plus the RDS-managed one plus 1 replica = 7 | 0.40 | 2.80 | 2.80 |
| CloudWatch | 5 alarms (`app.yaml` 4, `origin.yaml` 1), logs, metric filter | 0.10 per alarm plus ingestion | 1.50 | 2.50 |
| ECR | about 0.5 GB | 0.10/GB | 0.05 | 0.30 |
| S3 | a few GB | 0.025/GB | 0.25 | 1.00 |
| SES | under 2,000 messages | 0.10 per 1,000 | 0.00 | 1.00 |
| CloudFront | inside the free allowance at pilot scale | | 0.00 | 2.00 |
| **Total** | | | **about 72** | **about 88** |

That is consistent with the ROLLOUT range of 70-95. The difference from the report's 65-76 is mainly the public IPv4 lines (about 11) and the secrets.

The budget document counts 10 CloudWatch alarms (`AWS-PRODUCTION-BUDGET.md:24`); the templates define five. The rollout document's EC2 line (12-14) is higher than the list-price arithmetic (8.18); the repository does not explain the difference (not determined).

### Not in any of the tables

| Item | Why it can matter |
|---|---|
| RDS snapshots `pre-migrate-*` | one per deploy attempt; never deleted by the templates or the deploy document (file 04). Storage beyond the free allowance equal to the database size is billed. Small now, unbounded over time. |
| `postgresql` log export | the RDS-created log group has no retention set in the template (file 02). |
| Secrets Manager API calls | each deploy makes about ten reads; negligible. |
| Data transfer out | CloudFront egress is inside the free allowance at pilot scale (`ROLLOUT-PLAN-AND-BILLING.md:82`); instance egress is mostly AWS APIs. Not measured. |
| Savings Plan or reserved instance | not purchased; typically 25-35 percent off the EC2 and RDS lines (`ROLLOUT...:86`), not recommended before usage is steady. |
| Domain renewal at GoDaddy, individual's account | outside AWS (`ROLLOUT...:76`). |
| Free credits | USD 100 shown in the account; excluded from every figure (`AWS-PRODUCTION-BUDGET.md:7`). |

## 3. What would change the bill

| Change | Effect | Reference |
|---|---|---|
| `DbMultiAz=true` | about +18 (instance and storage double) | `AWS-PRODUCTION-BUDGET.md:49`; recommended before public launch by `DELIVERY-AUDIT-2026-10-12.md:100` |
| `InstanceType=t4g.medium` | about +8.2 | `AWS-PRODUCTION-BUDGET.md:48` |
| Staging stack | roughly doubles the table; owner decided against | `ROLLOUT...:84`, `AWS-NATIVE-ARCHITECTURE.md:3` |
| NAT gateway or interface endpoints to move the host private | about +40-56 | `AWS-PRODUCTION-BUDGET.md:58` |
| Extra WAF rule | +1 per rule | `:70` |
| CloudFront above 1 TB or 10 million requests | usage fees | `ROLLOUT...:82` |
| Longer `LogRetentionDays` | small | `app.yaml:96-99` |

## 4. Guardrails

`infra/budget/budget.json`: monthly cost budget `knest-production-monthly`, USD 100. `infra/budget/notifications.json`: three notifications to `pinakipattnaik@gmail.com`: actual spend above 50 percent, actual above 80 percent, forecast above 100 percent. The V1 report says the budget exists with three notifications (`V1-DEPLOYMENT-REPORT.md:116`). Observations:

- At the planning run-rate of USD 72-88 the 50 percent notification (USD 50) will fire in a normal month and the 80 percent (USD 80) may; they carry no information about an anomaly. The forecast alert at 100 percent is the useful one.
- An AWS Budget does not stop spending (`AWS-PRODUCTION-BUDGET.md:76`).
- The recipient is an interim personal mailbox; billing contact "should be an institutional mailbox" (`ROLLOUT...:92`). Whether the budget notifications and SNS alarm subscription are confirmed is not determined (`DRILLS.md:53-55`).
- No cost allocation tags are applied consistently: only `project` on the certificate and distribution and `Name`/`expires` on the instance; Cost Explorer filtering by tag (`ROLLOUT...:90-91`) will be thin.

## 5. Cost of the pipeline itself

GitHub Actions minutes (a 45-minute `image` job plus a 40-minute `integration` job per push, and a 60-minute-limit release job with QEMU arm64 builds) are not in the AWS tables; cost depends on the GitHub plan, not determined from the repository. Cloudflare Turnstile and GitHub OIDC are free (`ROLLOUT...:68`).
