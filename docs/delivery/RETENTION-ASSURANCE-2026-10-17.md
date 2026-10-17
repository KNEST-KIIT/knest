# Ten-year retention and controlled archive: engineering assessment

Source: owner-confirmed written privacy policy, sections “Retention and deletion” and “Data subject requests”; see [policy acceptance](POLICY-ACCEPTANCE-2026-10-17.md). Ten years followed by controlled archive is accepted. No renewed policy-source confirmation is needed. The written ten-year requirement supersedes the earlier five-year message. This assessment does not claim hosted compliance or supply the still-unaccepted archive procedures.

## Mapping and gaps

| Scope | Existing implementation | Remaining assurance or implementation |
|---|---|---|
| Accounts, profiles, applications and answers | PostgreSQL `app` schema, migrations; no general ten-year archive worker | Define retention start/event, preserve historical versions where needed, implement approved transfer/manifests and legal holds; demonstrate restore and authorised retrieval. A row remaining indefinitely is not a controlled archive. |
| Uploaded application documents | `src/server/applications/actions.ts` replaces document metadata and deletes superseded objects; `storage/reconcile.ts` can delete unreferenced keys after a 48-hour grace (dry run by default) | Decide and implement immutable record history before applying cleanup to retained records. S3 delete markers alone are insufficient: the production bucket expires noncurrent versions after 90 days (`infra/cfn/app.yaml`). Keep reconciliation dry-run; do not run apply as a retention remedy. |
| Events | `src/server/events/actions.ts` deletes the registration on cancellation | Preserve the registration/cancellation history under an accepted record model; notification/analytics summaries are not a replacement for the original record. No cancellation behavior changed in this PR. |
| Mentor/media/CMS records | Payload collections and audit hooks; delete audit rows retain identifiers/titles, not full deleted documents | Verify per-collection version/delete coverage and preserve original records plus media. `src/payload/audit-hooks.ts` explicitly does not copy document bodies and logs audit failures without failing the mutation. An audit label is not an archived record. |
| Communications and enquiries | Database enquiries, notifications and durable email outbox | `src/server/email/outbox.ts` clears delivered/expired bodies and clears dead-message bodies after seven days. Separate transient credential-bearing delivery payloads from retained correspondence; preserve a safe canonical communication record where required. Do not retain reset/verification secrets for ten years. |
| Lab/QR attendance | Database booking/attendance/audit records; administrative membership/configuration deletion exists | Record-history/hold/export and device data treatment remain unaccepted; flags stay off. This work does not enable labs, QR or offline. |
| Application/system/security logs | Docker awslogs into `/knest-production`; `LogRetentionDays` defaults to seven | Seven-day expiry is incompatible without independently proved continuous preservation. Choose an accepted archive pipeline before allowing hot-log expiry, or review an interim ten-year/no-expiry setting and its cost. Increasing retention cannot recover expired logs. |
| Database, edge, WAF, ALB and provider logs | RDS exports PostgreSQL logs; no managed log retention for its generated group here; edge/origin/WAF templates do not establish a full access/security-log archive | Inventory all collected log sources/regions and provider-managed expiry. Prove source coverage, restricted access, completeness, encryption, monitoring and historical gaps. App log-group evidence is only one source. CloudWatch metrics are not an access-log archive. |
| Recovery backups | RDS rolling backups: seven days; production snapshot/retain policies and S3 versioning | Keep existing recovery window/cost controls. Backups follow separately approved recovery procedures; seven-day backups do not automatically violate a ten-year *live-record* policy, and snapshots do not replace an archive. Prove recovery, holds and approved backup deletion treatment. |
| Auth sessions and one-time tokens | Logout/reset revokes/deletes session and token rows | These are security credentials, not an institutional record archive. Preserve appropriate redacted audit events separately; do not disable revocation or start retaining usable secrets. |

This is a focused code/template review, not an exhaustive legal classification of every table or upstream provider. No schema/data migration or destructive behavior was changed to guess unresolved archive, hold or exception procedures.

## Safe changes in this PR

1. `scripts/ops/retention-evidence.mjs` reads only scoped AWS metadata: identity, three app-stack physical resources, application log-group retention, upload versioning/lifecycle and RDS backup window. It never reads log messages, objects, rows, secrets or student data. It requires an explicit profile, rejects the documented root profile before invoking AWS, then rejects root/IAM-user/wrong-account sessions. An assumed-role ARN does not prove the role's IAM policy is least privilege; the operator must verify that separately.
2. The assessment flags short log retention and any enabled lifecycle expiry of records/versions. Missing observations and provider errors cannot produce compliance. The supported CloudWatch ten-year value is 3653 days; 3650 does not cover all calendar ten-year periods. Even adequate preservation is not controlled archive acceptance. The report remains `blocked`/`not-established` until the separate institutional archive work is evidenced.
3. Production application logs gain CloudFormation `Retain` deletion/replacement policies, matching the existing production data safeguards. S-1 rendering still uses `Delete` for complete disposable teardown. This protects only stack deletion/replacement; it does not override seven-day event expiry. The parameter description now makes that distinction explicit. No resource, hot-retention value, backup window, paid tier, lifecycle or recurring job was added or changed. Retained groups can continue to cost money after stack deletion and need an explicit disposition under the accepted procedures.

Exit codes: `1` means inventory completed but acceptance remains blocked; `2` means usage/access/observation failed. There is intentionally no “compliant” exit code: this collector cannot certify institutional procedures or collection completeness. Do not wire it into a deployment as an acceptance override.

## Provider/operator steps (not executed)

Use a verified scoped **assumed role** in account `166917387892`, Mumbai. Never select `claude-deploy` or another root identity. The cloud environment currently exposes no configured scoped AWS outbound identity or credential binding.

Metadata permissions needed: `sts:GetCallerIdentity`, `cloudformation:DescribeStackResource` on `knest-production-app`, `logs:DescribeLogGroups`, `s3:GetBucketVersioning`, `s3:GetLifecycleConfiguration` on its upload bucket, and `rds:DescribeDBInstances`. List/describe actions may require `Resource: '*'` where AWS has no resource-level support; this does not require secret/object/row access. Scope other actions to the stack/bucket where supported. No IAM mutation is performed by this tool.

Run from the repository root, storing evidence in a restricted operator workspace (do not publish unreviewed infrastructure inventory):

```sh
mkdir -p work
node scripts/ops/retention-evidence.mjs --profile <verified-scoped-role-profile> --stack knest-production-app > work/retention-evidence.json
```

Then:

- Inventory all retained record classes/log sources and oldest available dates, including RDS-generated log groups, edge/WAF/ALB/provider sources and archived exports. Record gaps; do not imply that a new retention setting restores prior losses.
- Have the records/security operator specify retention clock, archive destination/location, access owners, key custody/rotation, transfer manifest/integrity checks, legal holds/exceptions and authorised retrieval/restoration. This is operating implementation of accepted policy, not policy-source reconfirmation.
- Cost/review the archive design against the existing budget. Seven-day hot logs can remain only with proven preservation before expiry. A monthly export cannot protect seven-day logs. Design retries, overlap/deduplication and alarms against silent gaps; allow for CloudWatch export delays and quotas. Consider low-cost archive storage with restore/retrieval costs explicitly budgeted. Do not create billable services from this PR.
- Review a CloudFormation change set for the log-group retain policies and any separately accepted retention/archive changes. Verify that the pending app-template/runtime-identity update is reconciled first. No database/bucket/instance replacement or competing rollout is authorised here.
- Before destructive cleanup or lifecycle changes: prove canonical record history/holds, archive completeness and restore/retrieval using synthetic fixtures; resolve registration cancellation, superseded uploads, CMS deletion and communication-body treatment. Keep transient security credential revocation intact.
- Record exact SHA, configuration, collection coverage, restore/retrieval result and named archive operator acceptance before claiming hosted compliance. Public deployment, DNS and cutover remain separate gates.

## Verification

Local checks: the initial 13 retention tests passed, including short/missing log observations, expiry rules, absent bucket observations, root-profile refusal, root-session refusal and exact-group matching with read-only API calls. Full unit suite at that point: 55 files, 541 tests passed. Typecheck passed after typing the injected command runner. The final test results and review status are recorded in the PR; no live AWS metadata collection, provisioning, deletion, deployment or migration was performed.
