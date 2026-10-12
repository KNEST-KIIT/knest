# E6.14 Failure and recovery procedures

Every procedure here is derived from the templates and scripts. **None has been rehearsed on the hosted stack**: restore, rollback, alarm-to-person and capacity drills are NOT RUN (`docs/delivery/DRILLS.md:37-63`). Where a step is inference it says so. RPO and RTO are not known (`DELIVERY-AUDIT-2026-10-12.md:64`).

## 1. What is protected, and how

| Data / component | Mechanism | Gap |
|---|---|---|
| Database | RDS automated backups, 7 days, point-in-time restore; `pre-migrate-*` snapshot before each deploy; deletion protection and snapshot-on-delete (`app.yaml:246-272`, `:265`) | Single AZ by default; no cross-region copy; restore never timed; template has no `DBSnapshotIdentifier` property (see 3.3) |
| Documents and CMS media | S3 versioning (production), old versions expire after 90 days (`app.yaml:282-291`) | No replication; no restore procedure written (`RUNBOOK.md:249-251` is a PLACEHOLDER); the instance role has no `GetObjectVersion`, so a restore of a prior version is an operator/admin action |
| Host | none; holds no data of record | Replacement needs a new instance, user data, and a deploy; the previous container image is lost with the disk |
| Secrets | Secrets Manager; generated values only in the secret | Deleting a secret starts a recovery window (service default); no rotation procedure; the origin-verify replica is manual (file 15) |
| Images | ECR, last 20 images | Old digests expire; rollback to an old digest may be impossible (`RUNBOOK.md:200`) |
| DNS | GoDaddy zone left untouched at cutover; Route 53 zones `Retain` (`dns.yaml:45-58`) | `origin.kiitnest.com` record not in `dns.yaml` (D-08) |
| Mail | `app.email_outbox` with retries up to 8 attempts or 24 h; `EmailDeadAlarm` | alarm recipient unconfirmed |

## 2. Failure scenarios

| # | Failure | How it shows | Immediate action | Notes |
|---|---|---|---|---|
| F1 | New release never becomes healthy | Deploy step prints `NOT healthy after 90 s; rolling back`, previous container restored, invocation Failed (`app.yaml:644-649`) | Read the container log tail in the output; fix and release again | Not drilled (D5). The restored container is not health-checked. First-ever deploy has no previous image. |
| F2 | Migration fails | `migration failed; the previous version keeps running` (`app.yaml:619`), old container untouched | Read the migrate output; the pre-migrate snapshot exists | Possible half-applied state if the Drizzle step succeeded and Payload failed; compare `drizzle.__drizzle_migrations` and `cms.payload_migrations` before retrying. Migrate image can be run by hand with the same env. |
| F3 | Healthy but wrong behaviour after an additive-only release | users report | Redeploy the previous digests with the same SSM document (below) | The old migrate image runs first and applies only what it knows (`RUNBOOK.md:197`). |
| F4 | Release with a non-additive migration misbehaves | | Fix forward; if data damaged, restore (3.3) | Needs the engineering lead (`RUNBOOK.md:180`). Policy is additive-only (`RUNBOOK.md:153-158`); no check enforces it in CI. |
| F5 | Container exits at start: `Invalid production environment` | log lines list variable names | Fix the named setting at its source and redeploy | `src/instrumentation.ts:6-11`. |
| F6 | `/api/health` 503 | ALB target unhealthy; `HealthyTargetsAlarm`; CloudFront 502/503 | Check RDS state, security groups, CA bundle file, credentials (`RUNBOOK.md:283`) | If the runtime password secret was regenerated without a deploy, the new password is not in the container. A deploy re-runs the role script with the secret's current value (`runtime-role.ts` ALTERs the role). |
| F7 | Every page 403 | | Origin-verify mismatch (file 15), or `SITE_URL` mismatch for writes only | `RUNBOOK.md:284`. |
| F8 | Host fails status checks | `HostStatusAlarm` after 3 minutes | EC2 recover/reboot; if lost, replace the instance resource and run a deploy | A replaced instance has no container; there is no auto-recovery action in the template. Possible replacement by AMI drift (H-1) looks the same. |
| F9 | Disk full | `docker pull` fails in a deploy, before migration | free space (`docker image prune`) through Session Manager | no pruning exists (file 03). |
| F10 | RDS storage low | `DbStorageAlarm` below 4 GiB | increase `DbAllocatedStorageGb` (stack update; cannot shrink) | no autoscaling configured. |
| F11 | RDS CPU credits exhausted | `DbCpuAlarm` (15 min above 80 percent) | move to a larger class (`DbInstanceClass`) | brief outage on modify. The operator policy denies `rds:ModifyDBInstance` (`operator-policy.json:168`), so this goes through a change set under the service role. |
| F12 | Turnstile unreachable or wrong secret | sign-up, sign-in, reset, submit, enquiry refused with a 503-class message | check outbound 443, `turnstile-secret` value | `verifyTurnstile` fails closed (`turnstile.ts:44-50`). Not-configured in production also refuses (`:31`). |
| F13 | SES refuses (sandbox, identity not verified) | `email_outbox_retry` lines; later `EmailDeadAlarm` | verify identity, request production access (`EMAIL-SETUP.md:22-23`) | Mail is retried for 24 h, then dead; a person who never got a link must request another (resend path exists, `45-accounts-modules.test.ts:212-233`). |
| F14 | WAF blocks legitimate users | 403 from CloudFront | find the rule in sampled requests; set it to Count in `waf.yaml` | No logging configured; sampled requests only. |
| F15 | Certificate problem (alias, expiry) | browsers warn; `verify-production` check 1a | restore previous aliases/certificate parameters on the edge stack (`CUTOVER-RUNBOOK.md:59`) | ACM renewal depends on validation CNAMEs being in the authoritative zone. |
| F16 | Origin certificate expiry (ALB) | CloudFront 502 | re-validate (DNS record for `origin.kiitnest.com`) | The record lives at GoDaddy today, not in `dns.yaml`. |
| F17 | AWS session or credentials expire mid-operation | change set or SSM result unread | re-authenticate, then read results with `list-command-invocations --details` | Happened on 2026-10-11 (`OPERATOR-COMMANDS.md:54-56`). |
| F18 | Secrets lost/overwritten | app cannot start | restore from recovery window; for generated secrets, accept a new value and redeploy both sides | New `auth-secret` invalidates sessions; new `payload-secret` invalidates CMS sessions. Not tested. |

### 2.1 Roll back a release to previous digests (inferred procedure)

1. Obtain the previous app and migrate digests from the earlier run's summary (`release-image.yml:165-169`) or ECR (`ecr describe-images`), within the last 20 images.
2. `aws ssm send-command --document-name knest-production-deploy --targets Key=tag:knest-deploy-target,Values=production --parameters "Environment=production,AppImage=<uri>@sha256:...,MigrateImage=<uri>@sha256:..."` (`RUNBOOK.md:191-195`).
3. The document snapshots again, runs the old migrate image, swaps the container and health-checks.
4. Verify per `RUNBOOK.md:101-113`.

`/opt/knest/previous` on the host records the previous image reference but nothing reads it (`app.yaml:641`); it is for the operator.

## 3. Database recovery

### 3.1 Point-in-time or snapshot restore (not rehearsed)

RDS restores to a **new** instance with a new endpoint; it never overwrites. Draft steps (`DRILLS.md:37-47` D4, `RUNBOOK.md:239-247`):

1. Agree the restore time with the engineering lead and product owner. Everything written after it is lost. Keep the damaged instance until the incident closes.
2. `aws rds restore-db-instance-from-db-snapshot` (or point-in-time) into the same DB subnet group, with the database security group, class `db.t4g.micro`, not publicly accessible. The operator policy allows restore only for names `knest-drill-*` and `knest-production-*` (`operator-policy.json:112-127`).
3. Credentials: the restored instance carries the snapshot's database roles, including `knest_app` and its password. Whether the RDS-managed master secret follows the restored instance depends on the restore call setting `ManageMasterUserPassword`; **not determined from the code**. RUNBOOK flags it (`:243`).
4. Point the app at it. The endpoint is the SSM parameter `/knest-production/config/db-endpoint`, which is stack-managed (`app.yaml:430-432`) and whose value is the CloudFormation `Database` resource. Editing the parameter by hand is overwritten by the next stack update; a restored instance outside the stack is not tracked by the stack; the alarms (`DbCpuAlarm`, `DbStorageAlarm`) and snapshot permission reference the original identifier. Cleanly bringing a restored database under the stack needs a template change (a `DBSnapshotIdentifier` property or a resource import) that does not exist. This is the largest open design question in recovery (D-18).
5. Run a deploy so the container rebuilds its environment, then verify health, a sign-in and a row count against expectations (`DRILLS.md:47`).

Fastest practical path given today's template (inference): restore to a new instance, override the three SSM parameters by hand and the DB security group membership, deploy, accept stack drift, then reconcile by template change afterwards.

### 3.2 Which snapshot

Choose `pre-migrate-<ts>` for "just before the last release"; automated PITR for anything in the 7-day window. Names are listed with `aws rds describe-db-snapshots` (allowed by the operator policy).

### 3.3 Template limits that make restore harder

- No `DBSnapshotIdentifier` or `RestoreTime` parameter on `Database`.
- `DeletionProtection` blocks replacing the instance through the stack; a replace needs the protection turned off first (a deliberate speed bump).
- `UpdateReplacePolicy: Snapshot` takes a snapshot when the instance is replaced, so replacing through CloudFormation does not lose the data but gives a new empty instance unless restored from that snapshot.

## 4. Whole-host recovery

1. Replace or recreate `AppInstance` (stack update or `aws ec2` through the service role). User data installs Docker and the CA bundle.
2. Confirm the instance appears online in SSM and carries the tag `knest-deploy-target=production` (set by the template).
3. The ALB target group registers the instance by ID: after replacement the `origin.yaml` stack must be updated with the new `AppInstanceId` (it is a parameter, `origin.yaml:13`, `:85`). Forgetting this leaves the ALB with a dead target and `HealthyTargetsAlarm` firing. Alarm dimensions in `app.yaml` follow the new instance automatically.
4. Run a deploy with the current digests.

## 5. Regional failure

Not covered. Compute, database, S3, secrets and the ALB are in ap-south-1; snapshots are in-region; no cross-region copy is configured (`RUNBOOK.md:225`). CloudFront, WAF and the certificate are global/us-east-1 and would continue to serve cached static assets only. Recovery would be a rebuild from templates in another region with data restored from the last copied snapshot, which does not exist. The owner must accept this or fund cross-region backups (`RUNBOOK.md:225`).

## 6. Incident steps (from `RUNBOOK.md:292-298`)

Name a lead and write the time; contain (deactivate affected accounts through the Members screen; consider the maintenance or preview-gate state: set `AccessHash` on the edge stack, `RUNBOOK.md:208`); fix or roll back; inform the product owner and privacy contact (placeholders in `RUNBOOK.md:19-29`, no contacts supplied); write down what changed. **Putting the gate back** is an edge stack update with the SHA-256 of `user:password`, held outside the repository.
