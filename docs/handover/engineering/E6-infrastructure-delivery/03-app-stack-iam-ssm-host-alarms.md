# E6.03 `app.yaml`: instance role, SSM configuration, host, alarms, outputs

Source: `infra/cfn/app.yaml:357-494` and `:651-751`. The deploy document (`:496-649`) is in `04-deploy-document.md`.

## 1. Instance role `knest-${Environment}-ec2` (`app.yaml:357-421`)

Trust: `ec2.amazonaws.com` only. Managed policy: `AmazonSSMManagedInstanceCore`, which is what lets Run Command and Session Manager reach the host (no SSH, no key pair exists on the instance, see `AppInstance` below). One inline policy `app` holds nine statements:

| Sid | Actions | Resource | Why it is shaped this way |
|---|---|---|---|
| `DocumentsAndMedia` | `s3:GetObject`, `PutObject`, `DeleteObject` | `${Bucket.Arn}/*` | Application documents and CMS media. Delete is needed because superseded upload objects are removed after a replacement commits (`27-document-upload.test.ts:98`) and the reconciliation worker deletes orphans when `STORAGE_RECONCILE=apply`. No `s3:GetObjectVersion`/`DeleteObjectVersion`: the host cannot permanently destroy history in the versioned bucket. |
| `ListTheBucket` | `s3:ListBucket` | bucket ARN | Needed by the reconciliation listing (`ListObjectsV2`). |
| `SnapshotBeforeMigrating` | `rds:CreateDBSnapshot`, `DescribeDBSnapshots`, `AddTagsToResource` | the DB instance ARN and `snapshot:pre-migrate-*` | The deploy document creates `pre-migrate-<utc timestamp>`. Scoping the snapshot ARN to that prefix means the host cannot create or tag arbitrarily named snapshots. `DescribeDBSnapshots` is `Resource`-scoped here although several RDS describe calls ignore resource scoping; the `aws rds wait db-snapshot-available` call has worked in the three recorded deploys (`DRILLS.md:33-35`). |
| `PullImages` | `ecr:BatchGetImage`, `GetDownloadUrlForLayer`, `BatchCheckLayerAvailability` | this repository only | The host can pull and cannot push. |
| `EcrLogin` | `ecr:GetAuthorizationToken` | `*` | This action does not support resource scoping. |
| `ReadOnlyItsOwnSecrets` | `secretsmanager:GetSecretValue` | origin-verify, auth, payload, turnstile, RDS master, db-runtime | Explicit ARNs, no wildcard. See residual risk below. |
| `ConfigurationParameters` | `ssm:GetParameter(s)`, `GetParametersByPath` | `parameter/knest-${Environment}/*` | The deploy document reads `/knest-<env>/config/*`. |
| `Logs` | `logs:CreateLogStream`, `PutLogEvents`, `DescribeLogStreams` | the log group and its streams | Used by the Docker `awslogs` driver (host-side daemon). |
| `SendMailFromTheConfiguredAddressOnly` | `ses:SendEmail`, `SendRawEmail` | `*` | SES identities are separate resources; the control is the condition `ses:FromAddress == EmailFromAddress` (`app.yaml:415`). A message with any other envelope-from is refused by IAM. `templates.test.ts:122-130` asserts the condition is present and that no inline statement uses `"s3:*"`, `iam:` or `Action: "*"`. |

Assertions in `templates.test.ts:122-130` are string searches over JSON, not a policy simulation; they would not catch a wildcard introduced via a variable.

### Residual risk the policy design cannot remove

- The master-secret read is on the instance role because the migration job runs on the same host as the application. A host-level compromise (or a container escape; IMDS hop limit is 2 so containers can reach role credentials, `app.yaml:477-478`) therefore reaches the master credential. The runtime role limits the blast radius of an application-level SQL flaw, not of host compromise (`docs/delivery/IAM-OPERATOR-AND-SETTINGS.md:78-81`). The header comment in `src/db/runtime-role.ts:10-11` says the master secret "which the instance role may no longer read either; see app.yaml" is stale: `app.yaml:401` still grants it (D-06).
- Hop limit 2 is required for the S3 and SES SDK calls made from inside the container to reach IMDS (`app.yaml:477`); it is also what lets a compromised container request the same credentials.

## 2. `InstanceProfile` and the SSM parameters (`app.yaml:417-463`)

The profile name equals the role name. Non-secret settings are published as String parameters under `/knest-${Environment}/config/`:

| Parameter | Source | Read by deploy document as |
|---|---|---|
| `site-url` | `SiteUrl` | `SITE_URL`, `AUTH_URL` |
| `bucket` | `Bucket` | `S3_BUCKET` |
| `db-endpoint` | `Database.Endpoint.Address` | host in `DATABASE_URL` |
| `db-secret-arn` | RDS master secret ARN | which secret to read for migration |
| `db-runtime-secret-arn` | `DbRuntimeSecret` | runtime identity (optional; deploy doc tolerates absence) |
| `turnstile-site-key` | `TurnstileSiteKey` | `TURNSTILE_SITE_KEY` |
| `feature-lab-booking` | `FeatureLabBooking` | `FEATURE_LAB_BOOKING` |
| `site-indexing` | `SiteIndexing` | `SITE_INDEXING` |
| `enquiry-notify-email` | `EnquiryNotifyEmail`, only if non-empty | `ENQUIRY_NOTIFY_EMAIL` |
| `db-instance-id` | `Database` | snapshot target |
| `email-from` | `EmailFromAddress` | `EMAIL_FROM` |
| `secret-ids` | literal list of three secret names | unused (D-12) |

Because they are stack-managed, changing a value by `aws ssm put-parameter` is not the route; the next stack update would overwrite it (`OPERATOR-COMMANDS.md:58-61`). A changed parameter reaches the running container only at the next deploy, because the environment file is rebuilt per deploy (`RUNBOOK.md:117-120`). A stack update alone does not restart anything.

The handover `RUNBOOK.md:122-132` still lists `FEATURE_LAB_BOOKING`, `SITE_INDEXING` and `ENQUIRY_NOTIFY_EMAIL` as settings "the deploy document does not write today". That is no longer true: `app.yaml:587-590` writes all three. `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are still not written, so Google sign-in remains disabled on the host (D-13).

## 3. `AppInstance` (`app.yaml:465-494`)

| Property | Value | Reason |
|---|---|---|
| `DependsOn` | `PublicDefaultRoute` | User data downloads packages and the CA bundle; the route (and the gateway attachment) must exist first. |
| `ImageId` | `LatestAmiId` | See hazard H-1 in file 02. |
| `IamInstanceProfile`, `SubnetId`, `SecurityGroupIds` | role, public subnet A, app group | |
| `MetadataOptions` | `HttpTokens: required`, hop limit 2 | IMDSv2 only. `templates.test.ts:108-114`. |
| Root volume | 20 GB gp3, encrypted, delete on termination | `ROLLOUT-PLAN-AND-BILLING.md:57` budgets "about 30 GB"; the template says 20. The host holds no data of record. Each deploy pulls two images; nothing prunes old ones (D-09, below). |
| User data | `dnf install -y docker jq`, enable Docker, create `/opt/knest`, download the RDS global CA bundle | Runs once at first boot. A failure after Docker is installed leaves a half-built host with no alarm. `set -euo pipefail` stops the script; the instance stays "running" and passes EC2 status checks. |
| Tags | `Name`, `knest-deploy-target=<env>`, `expires` | The deploy role's `SendCommand` is conditioned on `ssm:resourceTag/knest-deploy-target` (`ci.yaml:161`). Removing the tag breaks deployment and `hosted-smoke-remote.sh` lookup (`scripts/ops/hosted-smoke-remote.sh:17`). |

There is no key pair, no EIP, no auto-recovery action and no Auto Scaling group. If the instance is lost, recovery is stack-level: replace the resource, wait for user data, run a deploy.

## 4. Alarms and notification (`app.yaml:651-726`, plus `origin.yaml:104-119`)

| Alarm | Metric | Rule | Missing data | Notes |
|---|---|---|---|---|
| `EmailDeadAlarm` | custom `EmailOutboxDead` from a metric filter on the literal `email_outbox_dead` in the app log group | Sum over 300 s greater than 0, 1 period | not breaching | One abandoned message is enough: a person asked for a verification or reset link and did not get it (`app.yaml:661-662`). Depends on the application logging that exact token (`src/server/email/outbox.ts`). If the app is renamed to log differently, the alarm silently never fires. |
| `HostStatusAlarm` | `AWS/EC2 StatusCheckFailed` Maximum | 60 s x 3 periods above 0 | breaching | Detects host failure only. It does not detect the container being down: a stopped or crash-looping container with a healthy instance does not alarm. Container health is covered only by `HealthyTargetsAlarm` (below). |
| `DbCpuAlarm` | `CPUUtilization` Average | 300 s x 3 above 80 | default (missing) | 15 minutes; a `t4g.micro` that exhausts CPU credits will sit near 100 percent for hours before this is useful. |
| `DbStorageAlarm` | `FreeStorageSpace` Minimum | 300 s x 1 below 4 GiB | default | Storage autoscaling is not configured, so the alarm is the only warning; 4 GiB is 20 percent of the initial 20 GB. |
| `HealthyTargetsAlarm` (origin stack) | `HealthyHostCount` Minimum, ALB + target group | 60 s x 2 below 1 | breaching | The only alarm that sees "the app is down". Subject to the 5xx gap below. |

All alarms act only on `AlertTopic` (OK actions and insufficient-data actions are not set). `AlertSubscription` exists only with `AlertEmail`. The notification path has never been proven to reach a person (`DRILLS.md:53-55`, D6 PARTIALLY DONE).

Not alarmed (from the template, confirmed by `RUNBOOK.md:269` and `:342`): HTTP 5xx rate, WAF blocks, CloudFront error rate, certificate expiry (ACM renews automatically only when validation records remain in the zone, `RUNBOOK.md:305`), budget (a Budget exists separately, `infra/budget/`), log-ingestion failures, outbox backlog growth short of `dead`. The two workers in `src/instrumentation.ts` (outbox, reconciliation) have no liveness alarm.

## 5. Outputs (`app.yaml:728-751`)

| Output | Consumer |
|---|---|
| `VpcId`, `PublicSubnetAId`, `PublicSubnetBId`, `AppSecurityGroupId`, `InstanceId`, `AlertTopicArn` | `origin.yaml` parameters |
| `InstancePublicDnsName` | S-1 HTTP origin only |
| `DatabaseEndpoint`, `BucketName`, `OriginVerifySecretName` | operators; `OriginVerifySecretName` is the `OriginVerifySecretId` parameter of `edge.yaml` |
| `DeployDocumentName` | the release workflow derives the same name by convention (`release-image.yml:201`) rather than reading the output |

## 6. What this template cannot do (design limits)

- **One host, one AZ for compute.** A deploy removes the container before starting the new one (`app.yaml:633`), so every release is an outage of up to the health-wait length. `DELIVERY-AUDIT-2026-10-12.md:63` says the same. There is no overlap and no second target.
- **No Docker image pruning.** Each release pulls an app image and a migrate image (the migrate image is the full build stage with development dependencies). The 20 GB root volume has no cleanup job in the template or the deploy document. Not determined from the code whether anything else prunes; none was found. Disk exhaustion would surface as a failed `docker pull` in the next deploy, which fails before migration and leaves the old container running.
- **No log shipping of the SSM command output.** The only record of a deploy is the Run Command invocation and the container's log stream.
