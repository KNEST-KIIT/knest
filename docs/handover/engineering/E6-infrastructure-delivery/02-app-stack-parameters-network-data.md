# E6.02 `app.yaml`: parameters, conditions, network, data and secrets

Source: `infra/cfn/app.yaml` (751 lines). This file covers lines 1-356. The instance role, SSM parameters, host, deploy document and alarms are in `03-app-stack-iam-ssm-host-alarms.md` and `04-deploy-document.md`.

Status line from the template itself (`app.yaml:6-12`): "written, not deployed, not validated by CloudFormation" is stale; the stack was created (see `01-topology-and-evidence-status.md`). The template is written in production form. Lines ending `# DELETION` are the only lines that differ for the disposable S-1 variant, produced by `scripts/render-cfn.mjs` (see `10-release-gate-tests-and-render.md`).

## 1. Parameters (`app.yaml:14-107`)

| Parameter | Type / default | Constraint | Why it exists, and what goes wrong |
|---|---|---|---|
| `Environment` | String; `s1` or `production` | AllowedValues | Names every resource (`knest-${Environment}-...`), the SSM path `/knest-${Environment}/config/`, the secrets and the deploy document. One template, two environments. |
| `AvailabilityZoneA`, `AvailabilityZoneB` | `AWS::EC2::AvailabilityZone::Name`; `ap-south-1a`, `ap-south-1b` | type check | RDS needs a subnet group spanning two AZs even for Single-AZ, and the ALB needs two subnets (`origin.yaml:74`). A mistyped AZ fails at validation. |
| `VpcCidr` | String; `10.20.0.0/16` | `^([0-9]{1,3}\.){3}[0-9]{1,3}/16$` | The four subnets are carved by `Fn::Cidr` with 8 host bits, which requires a /16 (`app.yaml:27-29`). |
| `InstanceType` | `t4g.small` | none | Graviton. The 2 GiB sizing was to be confirmed by S-1 (`AWS-PRODUCTION-BUDGET.md:47`); no S-1 result is on record, so 2 GiB is unmeasured under real load. |
| `DbInstanceClass` | `db.t4g.micro` | none | Smallest burstable class. 1 GiB RAM, so connection limits are low; not measured. |
| `DbEngineVersion` | `'16.11'` | `^16\.[0-9]+$` | A bare major or 16.1-16.8 is flagged deprecated for new instances (`app.yaml:39-40`). `AutoMinorVersionUpgrade` moves the instance forward afterwards; see section 6 for the downgrade trap. |
| `DbAllocatedStorageGb` | Number; 20 | 20 to 65536 | gp3 storage. RDS storage cannot be shrunk later. |
| `DbMultiAz` | `'false'`; `'true'`/`'false'` | AllowedValues | Doubles the instance and storage cost (`AWS-PRODUCTION-BUDGET.md:49`). The audit recommends enabling before public launch (`DELIVERY-AUDIT-2026-10-12.md:100`). |
| `CloudFrontPrefixListId` | String, no default | none (origin.yaml adds `^pl-[0-9a-f]+$`) | Needed only for the S-1 inbound rule; in production it is unused by `app.yaml` (the ingress is removed by `IsProduction`) but is still required, because a parameter without a default must be supplied. |
| `AppPort` | Number; 3000 | 1024 to 65535 | Host port the container publishes. Must match the target group port and the deploy document `HostPort`. |
| `LatestAmiId` | `AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>`; AL2023 arm64 path | type check | Resolves the newest AMI at every stack create or update. See section 6, hazard H-1. |
| `EcrRepositoryName` | `knest-app` | none | Used in the instance role's pull permission (`app.yaml:388`). Must equal `ci.yaml` `RepositoryName`. |
| `SiteUrl` | String | none (https is not enforced by the template) | Becomes `SITE_URL` and `AUTH_URL`. The application refuses cross-origin writes whose Origin is not this origin (`src/server/security/edge-guard.ts:46-56,73-80`). Setting it to the wrong host makes every sign-in and form post a 403; that happened on the preview and was fixed by a change set (`V1-DEPLOYMENT-REPORT.md:49`, `:95`). |
| `EmailFromAddress` | String | bare address pattern | Becomes `EMAIL_FROM` and is matched exactly by the `ses:FromAddress` IAM condition (`app.yaml:415`). A display-name form would silently fail the condition. |
| `TurnstileSiteKey` | String | `^[0-9A-Za-z_-]{5,}$` | Public site key. The deploy preflight refuses Cloudflare's three published test keys (`cutover-preflight.sh:36-38`). |
| `FeatureLabBooking` | `'false'` | true/false | `FEATURE_LAB_BOOKING`. Keep false until HD-16 is signed. |
| `SiteIndexing` | `'off'` | on/off | `SITE_INDEXING`. |
| `EnquiryNotifyEmail` | `''` | empty or bare address | Empty means contact messages are stored but nobody is emailed. The SSM parameter is created only when non-empty (condition `HasEnquiryNotifyEmail`). |
| `LogRetentionDays` | 7 | list of the 22 values CloudWatch accepts | Seven days is cheap and short. Note the 7 days applies to application logs only; RDS PostgreSQL log export has its own group. |
| `AlertEmail` | `''` | none | Empty creates the topic without a subscriber, so alarms notify nobody (`app.yaml:100-103`). An SNS email subscription also needs the recipient to click a confirmation link; until then the subscription is `PendingConfirmation` (`OPERATOR-COMMANDS.md:23-26`). |
| `ExpiresOn` | `''` | none | Informational tag, S-1 only. |

Not parameters, though one might expect them: database name `knest` and master user `knest_admin` are literals (`app.yaml:259-260`); backup retention, windows and the parameter-group settings are literals.

## 2. Conditions (`app.yaml:109-113`)

| Condition | Definition | Used by |
|---|---|---|
| `IsProduction` | `Environment == production` | App security group ingress (removed in production), `DeletionProtection`, `DeleteAutomatedBackups`, bucket versioning and lifecycle rule choice |
| `IsMultiAz` | `DbMultiAz == 'true'` | `MultiAZ` |
| `HasAlertEmail` | `AlertEmail != ''` | `AlertSubscription` |
| `HasEnquiryNotifyEmail` | `EnquiryNotifyEmail != ''` | `ConfigEnquiryNotifyEmail` |

## 3. Network resources (`app.yaml:116-228`)

| Resource | Shape | Why |
|---|---|---|
| `Vpc` | `VpcCidr`, DNS support and hostnames on | DNS hostnames give the instance a public DNS name (S-1 origin output). |
| `InternetGateway`, `GatewayAttachment` | standard | The host needs outbound 443 for AWS APIs, Turnstile and Google sign-in. |
| `PublicSubnet` | block index 0, AZ A, public IP on launch | Hosts the instance. |
| `PublicSubnetB` | block index 3, AZ B, no public IP on launch | Exists only so the ALB has two subnets in two AZs. Nothing else runs there. |
| `PrivateSubnetA/B` | blocks 1 and 2 | RDS only. |
| `PublicRouteTable` + default route + two associations | `0.0.0.0/0` to the IGW | `PublicDefaultRoute` has `DependsOn: GatewayAttachment` (`app.yaml:169`). |
| `PrivateRouteTable` + two associations | local route only | The database subnets "cannot reach, or be reached from, the internet" (`app.yaml:177`). The consequence: RDS cannot call out (no NAT), which is intended. |

`AppSecurityGroup` (`app.yaml:188-203`):

- Ingress: in production `AWS::NoValue` (no ingress at all); in S-1, the CloudFront prefix list on `AppPort`. In production `origin.yaml` adds a single ingress rule from the ALB group (`origin.yaml:59-66`). No SSH rule exists in either variant; access is SSM Session Manager (`docs/delivery/AWS-NATIVE-ARCHITECTURE.md:19`).
- Egress: only TCP 443 to `0.0.0.0/0` (`app.yaml:201-202`), plus 5432 to the database group (separate resource, below). Nothing else is reachable: no port 80, no SMTP 587/465. Consequence worth knowing: the `EMAIL_TRANSPORT=smtp` path cannot work from this host; only SES over 443 can. The integration suite tests SMTP (`global-setup.ts:72-76`), so the SMTP code path is proven in CI but is unusable on this infrastructure by construction.

`AppToDatabaseEgress` (`app.yaml:205-216`) is a standalone `SecurityGroupEgress` resource. The comment explains why: the database group's ingress names the app group, so naming the database group inline in the app group would be a circular dependency. Without this rule the 443-only egress would block PostgreSQL.

`DatabaseSecurityGroup` (`app.yaml:218-228`): ingress 5432 from the app group only; egress replaced by a rule to `127.0.0.1/32` "that matches nothing real" because a security group cannot be created with an empty egress list and the default allow-all would otherwise apply. `templates.test.ts:86-98` asserts no `CidrIp` appears in the database ingress.

## 4. Data resources (`app.yaml:231-305`)

### `DbSubnetGroup`, `DbParameterGroup`

The subnet group lists the two private subnets (`:235`). The parameter group (`:237-244`), family `postgres16`, sets `rds.force_ssl = 1` (server refuses unencrypted connections) and `log_min_duration_statement = 1000` ms (slow statements to the PostgreSQL log, which is exported to CloudWatch at `:272`). The application connects with `DATABASE_SSL=verify` and the RDS CA bundle (deploy document, `app.yaml:572-573`), so both ends enforce TLS.

### `Database` (`app.yaml:246-272`)

| Property | Value | Reason / failure mode |
|---|---|---|
| `DeletionPolicy`, `UpdateReplacePolicy` | `Snapshot` (S-1 render: `Delete`) | Deleting the stack or replacing the instance takes a final snapshot. Without `UpdateReplacePolicy` a replacement would drop data. |
| `StorageEncrypted` | true | AWS-managed key; key choice not specified, so the default `aws/rds` key. |
| `MultiAZ` | from `IsMultiAz` | Default off: a host-level or AZ failure is an outage until manual restore. |
| `PubliclyAccessible` | false | Plus private subnets plus SG. Three independent barriers. |
| `ManageMasterUserPassword` | true | RDS creates and manages the master secret in Secrets Manager. No person ever sees it. Risk: the managed secret rotates on RDS's schedule; the deploy document copies it into the container environment once per deploy, so a container that outlives a rotation holds a stale password (`RUNBOOK.md:348`, gap 12). When the runtime role is in use this is moot for the serving container (it uses `knest_app`, whose secret is not rotated by RDS); when the fallback is active, the exposure is real. |
| `BackupRetentionPeriod` | 7 days; window 21:00-22:00 | RDS reads the window as UTC (`RUNBOOK.md:217`). `templates.test.ts:91` asserts at least 7. |
| `PreferredMaintenanceWindow` | `sun:22:30-sun:23:30` | Overlaps no backup window. |
| `CopyTagsToSnapshot` | true | |
| `AutoMinorVersionUpgrade` | true | See hazard H-2. |
| `DeletionProtection` | production only | A stack delete fails until it is turned off by hand. That is the intent. |
| `DeleteAutomatedBackups` | false in production | Automated backups survive instance deletion for the retention period. |
| `EnableCloudwatchLogsExports` | `[postgresql]` | Log group is created by RDS with its own (infinite) retention, not controlled by `LogRetentionDays`; not determined from the template whether a retention is set elsewhere. |

### `Bucket` and `BucketPolicy` (`app.yaml:274-305`)

- Ownership `BucketOwnerEnforced` (ACLs disabled), full public access block, SSE-S3 (AES256).
- Versioning enabled in production only (`:282`). The documents bucket therefore keeps overwritten and deleted objects; the S-1 variant has no versioning and a 1-day expiry rule.
- Lifecycle: abort incomplete multipart uploads after 7 days; production: expire non-current versions after 90 days; S-1: expire every object after 1 day (`:288-291`).
- `DeletionPolicy: Retain` (S-1 render: `Delete`). A retained bucket blocks stack deletion neither way, but the S-1 `Delete` fails with `BucketNotEmpty` if objects remain; the 1-day lifecycle is the only mitigation, so the S-1 teardown is not guaranteed to be one step (inferred from S3 behaviour, not from a recorded run).
- Policy: a single `Deny` of `s3:*` on bucket and objects when `aws:SecureTransport` is false. There is no allow statement; access comes from the instance role (`app.yaml:371-378`).
- No server access logging, no KMS key, no replication. CMS media shares the bucket under `media/` (`RUNBOOK.md:41`); the reconciliation worker must therefore leave that prefix alone, which `41-storage-reconcile.test.ts:43` asserts.

## 5. Secrets (`app.yaml:307-349`) and logs (`:351-355`)

| Secret (name) | How generated | Who reads it | Notes |
|---|---|---|---|
| `knest-${Environment}/origin-verify` | 48 chars, no punctuation, at creation | Instance role (deploy doc -> `ORIGIN_VERIFY_SECRET`); CloudFormation of the edge stack via dynamic reference; the replica in us-east-1 | Region caveat: file 15. |
| `.../db-runtime` | JSON `{"username":"knest_app","password":<40 chars>}` | Instance role; deploy doc | The password for the least-privilege role. The role itself is created by the migration step (`src/db/runtime-role.ts`). |
| `.../auth-secret`, `.../payload-secret` | 64 chars each | Instance role | `AUTH_SECRET` and `PAYLOAD_SECRET`. Never handled by a person. No rotation procedure exists (`RUNBOOK.md:309`). |
| `.../turnstile-secret` | none: created empty | Instance role | A person must paste the Cloudflare secret. `V1-DEPLOYMENT-REPORT.md:39` records it was set to Cloudflare's always-pass TEST value; this must change before launch (gate G2, `cutover-preflight.sh:34-39`). Note that the preflight inspects only the site key, not the secret (`:38` says "secret not inspected"). |
| RDS-managed master secret | by RDS (`ManageMasterUserPassword`) | Instance role (migrate step only, by design) | ARN exposed as `Database.MasterUserSecret.SecretArn`. |

`ExcludePunctuation: true` on every generated secret keeps them safe inside `KEY=value` environment files and URLs. The master password is nevertheless URL-encoded with `jq @uri` in the deploy document because RDS-generated passwords can contain punctuation (`app.yaml:560`).

`ConfigSecretIds` (`app.yaml:458-463`) records three secret names in SSM; nothing in the repository reads it (not determined from the code that it is used anywhere; flagged as dead configuration, D-12).

`LogGroup` `/knest-${Environment}` (`:351-355`) receives container stdout/stderr through the Docker `awslogs` driver; streams are named `app-<epoch>` per container start (`app.yaml:636`).

## 6. Hazards in this part of the template

- **H-1, AMI drift replaces the host on any later stack update.** `LatestAmiId` is an `AWS::SSM::Parameter::Value` parameter (`app.yaml:61-63`). CloudFormation resolves such parameters at each create or update. When Amazon publishes a newer AL2023 arm64 AMI, the next change set (even one that only changes `SiteUrl`, with `UsePreviousValue=true`) shows `AppInstance` as a replacement. A new instance boots with Docker and the CA bundle but runs no container: the site is down until a deploy is run. `scripts/ops/cutover-apply.sh:113-119` creates and executes the change set without a pause, printing the diff only as it goes. `OPERATOR-COMMANDS.md:44` explicitly expects "No replacement of ... AppInstance" when reviewing manually; the script gives no chance to stop. Mitigation not in the code: pin `LatestAmiId` to a concrete AMI ID, or review the change set before execute.
- **H-2, engine version downgrade on update.** `DbEngineVersion` is pinned to `16.11` while `AutoMinorVersionUpgrade` is true. If RDS has moved the instance to a later minor, a later stack update with `UsePreviousValue=true` asks CloudFormation to set an older version, which RDS rejects. Not exercised; stated from RDS behaviour, not from a recorded failure.
- **H-3, missing CA bundle becomes a directory.** The bundle is fetched once, in user data (`app.yaml:490`). If the download fails, `set -euo pipefail` stops user data, and the deploy document's `-v /opt/knest/rds-global-bundle.pem:...:ro` bind mount (`app.yaml:606`) of a missing path makes Docker create a directory in its place; the app then cannot read the CA file and `/api/health` is 503. Symptom listed in `RUNBOOK.md:283`.
- **H-4, public IPv4 cost.** Three public IPv4 addresses (host plus two ALB nodes) are billed hourly (`ROLLOUT-PLAN-AND-BILLING.md:61`). See `13-cost-model.md`.
