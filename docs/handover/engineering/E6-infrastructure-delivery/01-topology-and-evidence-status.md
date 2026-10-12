# E6.01 Topology, stack inventory and evidence status

Scope: what the eight CloudFormation templates build, where each is deployed, in what order, and, before anything else, what has and has not been exercised on the hosted stack. Every later file in this volume assumes the status table below.

## 1. What has and has not been exercised on the hosted stack

This is the most important section of the volume. The repository contains two generations of documents: older ones that say "nothing is deployed" and newer ones that record a live private preview. The newer record wins where they conflict (see defect D-13 in `20-defects-and-open-items.md`).

| Claim | Status | Evidence |
|---|---|---|
| A private, password-gated preview is live on a `*.cloudfront.net` address | Reported as verified 2026-10-11 | `docs/delivery/V1-DEPLOYMENT-REPORT.md:6-26`; the audit repeats it as "verified" at `docs/delivery/DELIVERY-AUDIT-2026-10-12.md:9` |
| `kiitnest.com` is public | No | `V1-DEPLOYMENT-REPORT.md:6`, `DELIVERY-AUDIT-2026-10-12.md:9` |
| Stacks `knest-production-ci`, `-app`, `-origin` (ap-south-1), `-waf`, `-edge` (us-east-1) were created | Reported | `V1-DEPLOYMENT-REPORT.md:39` |
| `knest-production-ses` was created, three DKIM tokens issued, DNS records not yet added | Reported | `V1-DEPLOYMENT-REPORT.md:114` |
| `knest-production-cert` was requested and stayed `PENDING_VALIDATION` | Reported | `V1-DEPLOYMENT-REPORT.md:115` |
| `knest-production-dns` (Route 53) was deployed | Not determined from the code. The reports never list it as created; the preflight treats its absence as a failed gate (`scripts/ops/cutover-preflight.sh:79-81`) | n/a |
| The release workflow built, scanned and pushed images, and the exact-SHA CI gate worked | Reported | `V1-DEPLOYMENT-REPORT.md:18`, `:36`, `:132`; `docs/delivery/OPERATOR-COMMANDS.md:52-54` |
| An SSM deploy of the first release reached `healthy` | Reported once, on an older release | `V1-DEPLOYMENT-REPORT.md:109`; `DELIVERY-AUDIT-2026-10-12.md:59` |
| The newest release (runtime database role live) was confirmed running | No. The SSM command result was never read because the delegated AWS session expired | `V1-DEPLOYMENT-REPORT.md:132`; `OPERATOR-COMMANDS.md:52-56`; `DELIVERY-AUDIT-2026-10-12.md:11` |
| The runtime database role was exercised on RDS | No, only locally and in CI | `V1-DEPLOYMENT-REPORT.md:128`; `docs/delivery/DRILLS.md:20-31` |
| Hosted signed-in smoke test (`scripts/hosted-smoke.mjs`) was run on the host | No. Blocked by the safety classifier; committed but not run | `V1-DEPLOYMENT-REPORT.md:120`; `OPERATOR-COMMANDS.md:5-12` |
| `scripts/verify-production.mjs` was run against the live distribution | The command is recorded as blocked (needs the gate password); no evidence file exists under `docs/delivery/EVIDENCE/` matching `preview-verify-*` | `OPERATOR-COMMANDS.md:14-21`; directory listing of `docs/delivery/EVIDENCE/` |
| Snapshot before each migration exists on RDS | Yes, three snapshots named `pre-migrate-*` reported `available` | `DRILLS.md:33-35` |
| Snapshot restore, rollback to the previous container, alarm-to-person, capacity and hosted accessibility drills | NOT RUN | `DRILLS.md:37-63` |
| The disposable "S-1" spike (memory sizing for 2 GiB, origin-TLS comparison) was run | No result is recorded in any file read. `S-1-SPEC.md` is headed "NOT AUTHORISED TO START" | `docs/delivery/S-1-SPEC.md:3` |
| Load test against the application or AWS | Never run against the application or AWS | `docs/handover/LOAD-TEST.md:3-6` |
| CloudFormation validated the templates | The first real deployment is the only validation CloudFormation has performed; the unit tests check text and references only | `infra/cfn/templates.test.ts:6-12` |
| Real S3, SES and Turnstile behaviour | Never exercised by CI; integration tests use stubs (see `18-integration-files.md`). On the host, the first real SES, S3 and Turnstile traffic has not been recorded | `DELIVERY-AUDIT-2026-10-12.md:11`, `:60` |

Reading rule for the rest of this volume: when a section says "the deploy document does X", it is a statement about the template text. It has been executed on AWS a small number of times (the reports list three `pre-migrate-*` snapshots, which implies three deploy attempts reached the snapshot step), but its rollback branch and the runtime-role branch have no hosted evidence.

## 2. Topology

```
Visitor
  |  HTTPS (TLS 1.2+, SNI)                         [Route 53 zones: dns.yaml, after cutover]
  v
CloudFront distribution  (edge.yaml, deployed in us-east-1)
  - viewer-request function: canonical-host 301, optional Basic gate
  - WAF web ACL            (waf.yaml, us-east-1)
  - ACM certificate        (cert.yaml, us-east-1)  [aliases only; default cert during preview]
  - adds header X-Origin-Verify from a Secrets Manager dynamic reference
  |  HTTPS 443 to origin.kiitnest.com, TLS 1.2 only
  v
Application Load Balancer (origin.yaml, ap-south-1, two public subnets)
  - ACM regional certificate for origin.kiitnest.com (DNS-validated by hand)
  - security group: 443 only from the CloudFront origin-facing prefix list
  |  HTTP to port 3000
  v
EC2 t4g.small, Amazon Linux 2023, Docker, container "knest"   (app.yaml, public subnet A)
  - security group: no ingress except from the ALB group (production)
  - instance role: S3, RDS snapshot, ECR pull, Secrets Manager read, SSM params, Logs, SES
  |  PostgreSQL 5432 (TLS verified with the RDS CA bundle)
  v
RDS PostgreSQL 16 db.t4g.micro, private subnets only (app.yaml)

Side resources: S3 documents bucket, 6 Secrets Manager secrets, SSM parameters,
SNS alert topic, CloudWatch alarms, SES identity (ses.yaml), ECR repo + GitHub OIDC roles (ci.yaml)
```

Why the shape: the owner decided on one production environment and no permanent staging (`docs/delivery/AWS-NATIVE-ARCHITECTURE.md:3`, i.e. line 3 of that file). The host is in a public subnet rather than a private one behind a NAT gateway because a NAT (or six interface endpoints) was priced at roughly USD 40 or more per month, about doubling the bill (`docs/delivery/AWS-PRODUCTION-BUDGET.md:57-59`). The ALB exists because CloudFront validates the origin certificate against the origin host name and an EC2 public DNS name cannot hold a public certificate (`AWS-PRODUCTION-BUDGET.md:61-63`); `edge.yaml` also refuses to deploy a production distribution with `http-only` (`infra/cfn/edge.yaml:69-76`).

## 3. Stack inventory

| Template | Stack name used | Region (actual) | What it owns | Depends on |
|---|---|---|---|---|
| `ci.yaml` | `knest-production-ci` | ap-south-1 | ECR repo, GitHub OIDC provider, push role, deploy role | nothing |
| `app.yaml` | `knest-production-app` | ap-south-1 | VPC, subnets, EC2, RDS, S3, secrets, SSM parameters, deploy document, alarms, SNS | prefix list id (manual lookup) |
| `origin.yaml` | `knest-production-origin` | ap-south-1 | ALB, listener, target group, regional ACM certificate, ALB security group, health alarm | outputs of `app.yaml`; DNS validation CNAME for `origin.kiitnest.com` installed by hand |
| `waf.yaml` | `knest-production-waf` | us-east-1 | CLOUDFRONT-scope web ACL | nothing |
| `cert.yaml` | `knest-production-cert` | us-east-1 | ACM certificate for the four hostnames | DNS validation CNAMEs installed by hand |
| `edge.yaml` | `knest-production-edge` | us-east-1 (see note) | CloudFront distribution, viewer function, cache and header policies | `waf.yaml` ARN, ALB DNS name, replicated origin-verify secret, optionally `cert.yaml` ARN |
| `dns.yaml` | `knest-production-dns` | any (Route 53 is global); the cutover script uses us-east-1 | Two hosted zones and the mail/verification records, web aliases when the CloudFront name is supplied | `edge.yaml` output |
| `ses.yaml` | `knest-production-ses` | ap-south-1 | SES domain identity with Easy DKIM | DKIM CNAMEs installed by hand |

Note on the edge region: the header of `infra/cfn/edge.yaml:5` says "DEPLOY IN ap-south-1", while `V1-DEPLOYMENT-REPORT.md:39` says the edge stack is in Virginia, and `scripts/ops/cutover-apply.sh:42,47,55,62` all use `us-east-1` for the edge and dns stacks. The latter two are what actually runs. The template header is wrong (D-02).

Stack names are not in the templates. They are fixed by convention in `scripts/ops/cutover-apply.sh:42-63`, `docs/delivery/OPERATOR-COMMANDS.md:33-56` and `V1-DEPLOYMENT-REPORT.md:39`.

## 4. Deploy order and why

1. `ci.yaml`: creates the ECR repository, the OIDC trust and the two roles. Needs the GitHub repository slug. The GitHub Environment `production` is then configured by hand with the stack outputs as variables (`.github/workflows/release-image.yml:11-16`).
2. `app.yaml`: needs the CloudFront origin-facing managed prefix list ID, which must be looked up (`infra/cfn/app.yaml:52-54`). The Turnstile secret is created empty and must be filled by a person (`app.yaml:344-349`); the first deploy fails loudly if it is not (`docs/handover/RUNBOOK.md:63`).
3. `origin.yaml`: consumes `VpcId`, the two public subnet IDs, instance ID, app security group ID and the alert topic ARN, all outputs of `app.yaml` (`app.yaml:728-751`). The certificate stays `CREATE_IN_PROGRESS` until the validation CNAME exists at the DNS provider (`origin.yaml:6-7`).
4. `waf.yaml`, then `cert.yaml` (both us-east-1). `cert.yaml` also blocks until its four CNAMEs exist.
5. `edge.yaml`: needs the ALB DNS name via the `origin.kiitnest.com` CNAME, the web ACL ARN, and the replicated origin-verify secret (`15-secret-replication-caveat.md`).
6. `ses.yaml`, `dns.yaml`: independent; `dns.yaml` is only needed for cutover.

The deploy order in `docs/handover/RUNBOOK.md:54-61` omits `origin.yaml` and `ses.yaml` and has `edge.yaml` "see its header". That table predates the load balancer being added and is stale.

## 5. Pipeline at a glance

```
push -> ci.yml (static, integration, image jobs, no cloud credentials)
manual dispatch -> release-image.yml
    verify-source : latest ci.yml push run for exactly GITHUB_SHA must be success
    build-and-push: secret scan, OIDC assume push role, build arm64 app + migrate images,
                    push by tag app-<sha>/migrate-<sha>, wait for ECR scans, accept digests
                    only if COMPLETE and CRITICAL+HIGH == 0
    deploy        : OIDC assume deploy role, SSM send-command of knest-<env>-deploy with digests
host: snapshot -> migrate (master) -> runtime role -> start -> health -> rollback if unhealthy
```

Details are in files 04, 08, 09.
