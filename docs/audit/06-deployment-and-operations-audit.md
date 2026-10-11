# Deployment and operations audit
## Observed state versus configuration
Safe anonymous GET/DNS by Security/SRE investigator on 9 October 2026 about 17:10 IST: Vercel hostname HTTP 503; kiitnest.com HTTP 200 with 114 bytes and no title/KNEST marker; kiitnest.in fails DNS resolution from local resolver. .com NS ns43/ns44.domaincontrol.com, MX smtp.google.com priority 1, A 15.197.148.33/3.33.130.190. DNS resolution proves neither registrar ownership nor mail delivery. No production POSTs, cloud changes or authenticated AWS inventory performed.

| Capability | Status | Evidence / qualification |
|---|---|---|
| Vercel maintenance response | VERIFIED OPERATIONAL | Checked 503 response; containment, not product |
| Canonical domain serving KNEST | MISSING | Checked .com response does not demonstrate KNEST |
| Redirect domain | MISSING | Local DNS NXDOMAIN; registration/ownership unknown |
| DNS/current Google mail records | VERIFIED OPERATIONAL | Resolution only; full zone and mail delivery unknown |
| EC2/RDS/S3/CloudFront/WAF/ECR stack | CONFIGURED NOT VERIFIED | IaC exists; authenticated inventory absent |
| Origin TLS | MISSING | F03; no complete endpoint in templates |
| Runtime container artifact | CONFIGURED NOT VERIFIED | CI container builds/runs verified; no production digest evidence |
| CI verification | VERIFIED OPERATIONAL | Exact HEAD three jobs successful; current dirty tree separate |
| Deployment promotion/rollback | CONFIGURED NOT VERIFIED | SSM/release workflow, F07/F08 |
| Environment separation | CONFIGURED NOT VERIFIED | one production plus disposable S-1 decision; synthetic/private process unproved |
| Permanent staging | NOT APPLICABLE | Explicitly superseded by owner decision |
| Secrets/IAM/billing ownership | UNKNOWN | Role templates exist; real scoped access/owners not verified |
| Private RDS/TLS/encryption | CONFIGURED NOT VERIFIED | app.yaml/ssl client; no live connection proof |
| Backups/PITR/pre-migration snapshot | CONFIGURED NOT VERIFIED | seven-day RDS, snapshot wait; no restore drill |
| Object storage/versioning/retention | CONFIGURED NOT VERIFIED | Private S3/versioning; current orphan retention unresolved |
| SES operational delivery/domain authentication | UNKNOWN | SDK code exists; no current identity/quota/delivery proof |
| Turnstile real service | CONFIGURED NOT VERIFIED | Implementation/stub tests; hostname/key challenge unproved |
| Logs and infrastructure alarms | CONFIGURED NOT VERIFIED | three CloudWatch alarms and app logs configured |
| User-facing health/alerts/responders | MISSING | F10; no accepted drill/owner evidence |
| CloudTrail/Budgets/backup policies | UNKNOWN | Described, not all resources implemented/proved |
| Restore/disaster recovery | MISSING | Draft runbook; no measured drill |
| Background scheduling/retries/cleanup | MISSING | Required lifecycle functionality absent; no extra queue platform mandated |
| Support/training/incident ownership | UNKNOWN | Handover exists, contacts/acceptance placeholders |

## F03 — Production requires origin HTTPS but no TLS endpoint is implemented
**P0 deployment blocker; high confidence.** `infra/cfn/edge.yaml:69–76` forces https-only in production. `app.yaml:177–185,434–460,561–564` maps plain container port 3000; Dockerfile50–55 has no TLS listener. A parameter switch cannot supply a certificate/proxy.
Remedy: complete ALB+ACM regional certificate/security groups/health checks or managed host TLS with trusted certificate and proved renewal. CloudFront viewer certificate in us-east-1 is distinct from ALB certificate in ap-south-1. Private/self-signed origin certificates do not satisfy CloudFront automatically. [AWS origin HTTPS requirements](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-https-cloudfront-to-custom-origin.html).
Verify private synthetic deployment's end-to-end HTTPS, CA/hostname/renewal and direct-origin rejection. This is a missing design dependency, not observed plaintext production traffic.

## F06 — Runtime database master identity and stale managed credential
**P1 security/reliability; high source confidence, live impact unobserved.** `app.yaml:246–247,513–525` fetches RDS-managed master secret once into container environment for both app and migration. Runtime obtains excessive database privileges and has no demonstrated refresh when password rotates. Existing pooled connections may continue while subsequent connections fail; do not claim an exact outage date.
Separate migration/provision principal from least-privilege DML runtime for app+CMS. Define application secret rotation/reconnection/restart behavior and secret access scope. Prove runtime cannot DDL/create roles and controlled rotation recovers connections. AWS explicitly recommends least-privilege app users instead of master credentials. [Managed rotation guidance](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets_managed.html), [RDS password management](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html).

## F07 — Snapshots exist; recovery and schema-compatible rollback are unproved
**P1 operational work; P0 acceptance gate before important real data; high confidence.**
Current `app.yaml:548–552` creates/waits for a pre-migration RDS snapshot. This corrects prior evaluator claims of no snapshot. Migrations run while old app serves (lines 555–556); old container is removed (line 560) before replacement health. Failure restarts old image (lines 573–574) against changed database; no database restoration occurs.
Runbook lines 239–247 explicitly marks restore draft/unperformed. CMS-bookings drop migration destroys data if old records exist; no populated prior-state inspection was authorized.
Remedy: choose bounded maintenance outage or compatible overlapping deployment; enforce expand/contract and old/new schema compatibility; rehearsal of populated upgrade and restore to new DB with changed endpoint/credentials; explicit write cut-off/data loss decision; manual snapshot retention.
Verification: restore both schemas/files metadata, row consistency and application journey, measure RPO/RTO, rehearse image failure and schema failure, retain evidence. No generated down migration can promise deleted-row recovery.

## F08 — Manual release can deploy a revision without successful required CI
**P1 release blocker work; high confidence.** `release-image.yml:119` deploy needs only build-and-push. It does not check required CI results for exact SHA. ECR ScanOnPush in `ci.yaml:54` is not waited/evaluated. Protected Environment reviewer/branch settings are external and unknown. Current HEAD CI is green, but workflow policy remains unenforced.
Require exact accepted commit→tested image digest→scan disposition→manual production authorization. Verify failed/absent CI blocks promotion without live deployment; inspect actual Environment/OIDC scopes under authorized read-only access. Do not infer protection from YAML comments.

## F10 — Operational health, alert delivery and ownership not established
**P1; high confidence in missing evidence/source.** Only host status / DB CPU / DB storage alarms (`app.yaml:588–627`). Docker unhealthy status does not itself ensure restart. `api/health/route.ts:11–18` checks DB only. A healthy VM can host a dead app or broken verification mail. Current budget/runbooks mention more alarms/backups/CloudTrail/Budgets than IaC provisions.
Add external HTTPS and synthetic critical-journey checks, application/edge 5xx, low memory / disk / DB connections and mail-failure signals appropriate to measured pilot. Confirm subscriber/support contacts and incident response. Budget alerts are notifications, not a spend cap. Prove controlled alarm delivery, recovery escalation, cost review, log redaction and cleanup ownership.

## F24 — Hosted release and domain integration not verified
**P0 readiness gate; high confidence; not a code defect.** Observed endpoints do not serve a usable released KNEST product. AWS templates, URLs, a green Docker job and historical notes do not prove live deployment. Registrar, cloud ownership, DNS full record set and mail remain separate. Resolve through authorized private-first provisioning/acceptance and approved cutover manifest, preserving Google MX/TXT/DKIM/verification records. Certificate DNS validation may be done at current authoritative provider; nameserver cutover need not be a prerequisite.

## Minimal hosting approaches
| Approach | Fit/tradeoffs | Migration/setup impact | Planning recurring range |
|---|---|---|---|
| Existing EC2/RDS + proved host TLS | Lowest cost, single host; certificate renewal/patching owned by team | Finish host proxy/certificate/monitor/renewal; same app/database/storage | USD 50–70/month |
| EC2/RDS + ALB/ACM origin TLS | Recommended if no demonstrated host TLS operator; managed cert lifecycle, two-AZ ALB but still single app / Single-AZ DB | Add ALB/regional ACM/security groups/health checks; no product rewrite | USD 75–110/month |
| Lightsail managed container + managed DB | AWS-native alternative, simpler control plane but revalidate engine/constraints/encryption/networking and integrations | Rework IaC/IAM/deploy/backup; existing templates less reusable | Roughly USD 70–120/month after needed controls; not a validated design |
| Higher memory / Multi-AZ expansion | Reliability/capacity if measured needs/SLO demand | Retain app; larger compute/HA database and drills | USD 100–160+ per month planning |

Lightsail published 2 GiB container tier is USD 40/month, with database/network/security extras; do not assume cheapest unencrypted database tier meets requirements. [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/). Existing owner AWS-only decision makes a provider migration unjustified without evidence. No Kubernetes/microservices/multi-region requirement is proposed.

Costs are planning estimates, not account quotes. Full assumptions, omitted costs, price links and staffing/setup are [09](09-estimates-roadmap-and-critical-path.md). Nothing was provisioned, configured or cut over by this audit.

