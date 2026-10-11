# Scoped operator identity, MFA and routine-command allow-list (draft)

Date: 2026-10-11. Status: drafted for the account owner to create. Nothing here was created in AWS. Today the `claude-deploy` profile resolves to the **account root**; that is the finding this document closes.

## Files

| File | Purpose |
|---|---|
| `infra/iam/operator-policy.json` | Permissions of role `knest-production-operator`: change-set based stack changes on `knest-production-*` only, deploy and smoke via SSM, read-only observation, snapshot and restore drills, Route 53 record changes. Explicit deny on reading secret values, identity changes and deletions. |
| `infra/iam/operator-trust-mfa.json` | Trust policy: only IAM user `knest-operator`, only with MFA, session tokens no older than 4 hours. |
| `infra/iam/user-assume-only.json` | The user's own policy: may do nothing except assume the role and manage its own MFA. |
| `infra/iam/cfn-service-role-trust.json` | Trust for `knest-production-cfn-deploy`, the CloudFormation service role stack changes run as, so the operator role never needs IAM write rights. |

## Create (owner, once, as root or an admin; then stop using root)

1. Create role `knest-production-cfn-deploy` with trust `cfn-service-role-trust.json` and permissions for the resources the five stacks manage (start from `AdministratorAccess`, then narrow after one clean deploy; recorded as a follow-up).
2. Create role `knest-production-operator` with trust `operator-trust-mfa.json` and inline policy `operator-policy.json`.
3. Create IAM user `knest-operator`, attach `user-assume-only.json`, enrol a virtual MFA device, create **one** access key for the user (the only long-lived key; rotate each 90 days).
4. In `~/.aws/config`:
   ```
   [profile knest-operator]
   role_arn = arn:aws:iam::166917387892:role/knest-production-operator
   source_profile = knest-operator-user
   mfa_serial = arn:aws:iam::166917387892:mfa/knest-operator
   region = ap-south-1
   ```
5. Deactivate and delete any root access keys; enable MFA on root; enable "IAM user and role access to Billing information" so finance can read bills.
6. Stack changes then use `--role-arn arn:aws:iam::166917387892:role/knest-production-cfn-deploy`.

Verify: `aws sts get-caller-identity --profile knest-operator` shows an assumed-role ARN, not `:root`.

## Allow-list for routine commands (Claude Code settings)

Template only; it was **not** installed. To adopt it the owner merges the block into `.claude/settings.local.json`. Read-only commands are allowed; every mutating command keeps its prompt, and change sets are the reviewed path.

```json
{
  "permissions": {
    "allow": [
      "Bash(aws sts get-caller-identity:*)",
      "Bash(aws cloudformation describe-stacks:*)",
      "Bash(aws cloudformation describe-change-set:*)",
      "Bash(aws cloudformation describe-stack-events:*)",
      "Bash(aws cloudformation validate-template:*)",
      "Bash(aws ssm get-parameter:*)",
      "Bash(aws ssm list-commands:*)",
      "Bash(aws ssm list-command-invocations:*)",
      "Bash(aws ssm get-command-invocation:*)",
      "Bash(aws ecr describe-images:*)",
      "Bash(aws ecr describe-image-scan-findings:*)",
      "Bash(aws rds describe-db-snapshots:*)",
      "Bash(aws rds describe-db-instances:*)",
      "Bash(aws acm describe-certificate:*)",
      "Bash(aws acm list-certificates:*)",
      "Bash(aws sesv2 get-email-identity:*)",
      "Bash(aws sesv2 get-account:*)",
      "Bash(aws budgets describe-budgets:*)",
      "Bash(aws cloudwatch describe-alarms:*)",
      "Bash(aws logs filter-log-events:*)",
      "Bash(bash scripts/ops/cutover-preflight.sh:*)",
      "Bash(node scripts/verify-production.mjs:*)",
      "Bash(node scripts/dns-compare.mjs:*)"
    ],
    "deny": [
      "Bash(aws iam:*)",
      "Bash(aws cloudformation delete-stack:*)",
      "Bash(aws rds delete-*:*)",
      "Bash(aws s3 rb:*)",
      "Bash(aws s3 rm:*)",
      "Bash(aws secretsmanager get-secret-value:*)"
    ]
  }
}
```

Deliberately not allow-listed: `create-change-set`, `execute-change-set`, `ssm send-command`, `route53 change-resource-record-sets`, `budgets create-budget`. Those change production and stay prompted. The classifier blocked blind `update-stack` in this session; the change-set route (create, read the diff, execute) passed and is the documented way.

## Residual risk (stated, not hidden)

- The application container can reach the instance role through the metadata service (hop limit 2 is needed for S3 and SES). The role may read the database master secret because the deploy document runs migrations as master on the same host. The runtime database role therefore limits what a **SQL-level** flaw can do, not what a **host-level** compromise can do. Closing that needs the migration step moved off the app host (a separate task role). Recorded as post-launch work.
- The operator role cannot read secret values by design. Reading the preview password is a human action.
