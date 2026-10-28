# Operator commands (things the safety classifier or a human step blocked)

Date: 2026-10-11. Run from the repository root with a profile for account `166917387892` (`PYTHONUTF8=1`, `MSYS_NO_PATHCONV=1` on Windows Git Bash). Each item says what it does, the expected result and how to verify. Nothing here deletes data.

## 1. Signed-in smoke test on the live host (blocked: remote script that reads secrets and writes synthetic rows)

```
AWS_DEFAULT_REGION=ap-south-1 bash scripts/ops/hosted-smoke-remote.sh \
  166917387892.dkr.ecr.ap-south-1.amazonaws.com/knest-app@sha256:2e3e57b840e3fc4770c25da2bac8a12654b0312aa4e4640c1f57c53734524649
```

Runs `scripts/hosted-smoke.mjs` inside the migrate image on the app host through SSM: sign up, mark verified in the database, sign in, staff creates an open program, apply with answers and a PDF upload, submit, staff review (list, detail, document download, status change), enquiry. Expected: a list of `PASS` lines and `N passed, 0 failed`. It deactivates its synthetic accounts and closes its program. Rows it created (`smoke-*@knest.invalid`, one application, one document) stay as evidence; remove them only by an explicit, reviewed SQL statement.

## 2. Gate-password checks from outside (blocked: reading the preview password)

```
export KNEST_VERIFY_BASIC="knest:<password from preview-gate.txt>"   # never commit or echo
node scripts/verify-production.mjs --url https://d1vipkpsr3l07w.cloudfront.net --gate --waf --evidence docs/delivery/EVIDENCE/preview-verify-$(date +%F).md
```

Expected: all PASS, 401 without credentials.

## 3. Confirm the alert subscription (human)

An SNS mail "AWS Notification - Subscription Confirmation" went to `pinakipattnaik@gmail.com`. Click Confirm. Verify:
`aws sns list-subscriptions-by-topic --region ap-south-1 --topic-arn <knest-production-alerts ARN> --query 'Subscriptions[].SubscriptionArn'` shows an ARN, not `PendingConfirmation`. The AWS Budget notices (50 percent, 80 percent, forecast 100 percent of USD 100) go to the same address and need no confirmation.

## 4. GoDaddy DNS records (needs the account owner's emailed one-time code)

Exact records are in `CUTOVER-RUNBOOK.md`: two ACM validation CNAMEs for `kiitnest.com`, two for `kiitnest.in` if hosted at GoDaddy, three SES DKIM CNAMEs. Verify:
`aws acm describe-certificate --region us-east-1 --certificate-arn arn:aws:acm:us-east-1:166917387892:certificate/c49fe3e8-cbc9-4f4b-8aee-2ce405658e31 --query Certificate.Status` becomes `ISSUED`; `aws sesv2 get-email-identity --region ap-south-1 --email-identity kiitnest.com --query VerifiedForSendingStatus` becomes `true`.

## 5. Release the new code (after CI is green on the pushed commit)

1. GitHub Actions, workflow `release-image`, dispatch for the new commit SHA. Wait for the exact-SHA CI gate and the ECR scan gate; it prints the app and migrate digests.
2. Update the app stack template (adds the runtime-role secret, the dead-mail alarm), reviewed as a change set. **Since 2026-10-28 `infra/cfn/app.yaml` is larger than CloudFormation's 51,200-byte inline limit, so it must be uploaded to S3 and passed by URL: do item 9, step 0 first.** (`--template-body` would fail with a size error.)
   ```
   aws cloudformation create-change-set --stack-name knest-production-app --change-set-name release-r1 \
     --template-url https://knest-templates-166917387892.s3.ap-south-1.amazonaws.com/knest/app-<short-sha>.yaml --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM \
     --parameters $(aws cloudformation describe-stacks --stack-name knest-production-app --query 'Stacks[0].Parameters[].ParameterKey' --output text | tr '\t' '\n' | awk '{printf "ParameterKey=%s,UsePreviousValue=true ",$1}')
   aws cloudformation describe-change-set --stack-name knest-production-app --change-set-name release-r1 --query 'Changes[].ResourceChange.[Action,LogicalResourceId,Replacement]' --output text
   aws cloudformation execute-change-set --stack-name knest-production-app --change-set-name release-r1
   ```
   Expected additions: `DbRuntimeSecret`, `ConfigDbRuntimeSecretArn`, `EmailDeadMetricFilter`, `EmailDeadAlarm`; modifications: `InstanceRole` policy, `DeployDocument`. No replacement of `Database`, `Bucket` or `AppInstance`.
3. Redeploy:
   ```
   aws ssm send-command --document-name knest-production-deploy --instance-ids i-0dbccc58bd903416e --region ap-south-1 \
     --parameters "AppImage=<ecr>/knest-app@sha256:<app>,MigrateImage=<ecr>/knest-app@sha256:<migrate>"
   ```
   Verify in the command output: `runtime role: knest_app created ... privileges applied`, `App identity: runtime role knest_app`, `healthy`. Then run item 1.

### Item 5 status (2026-10-11 late)

- CI is green on `c477da7` and the release workflow built and scanned the images: app `sha256:113a8d672d6731437fb157bc58f1cb2f3c546f0e878f2d9a8936ad63c098c7fc`, migrate `sha256:4e62415785319b56946dc0076f592ccd20b4552261711d068cb3115a5a5103dd`.
- The template change set `release-r1` was applied once and **rolled back by CloudFormation** (`DeployDocument` needs replacement and has a custom name). Fixed in the template with `UpdateMethod: NewVersion` (commit after `c477da7`). Re-run step 2 with a fresh change set name; expect `DeployDocument` as `Modify` with replacement `False`.
- An SSM deploy of the new digests (command `8cd6b03e-a29e-4050-a69b-5bd0dd2339a7`) was started with the OLD document, so it migrates with the master identity and runs the app as master (the safe fallback). Read its result with `aws ssm list-command-invocations --command-id 8cd6b03e-a29e-4050-a69b-5bd0dd2339a7 --details`. The AWS session expired before it could be read. After step 2, run step 3 again so the runtime role is created and used.

## 6. Real Turnstile keys (Cloudflare dashboard, human)

Create a Turnstile widget for `kiitnest.com` and the preview hostname, then:
`aws ssm put-parameter --overwrite --name /knest-production/config/turnstile-site-key --type String --value <site key>` is NOT the route (that parameter is stack-managed); instead pass `TurnstileSiteKey=<site key>` as a stack parameter (change set as in item 5) and store the secret with `aws secretsmanager put-secret-value --secret-id knest-production/turnstile-secret --secret-string <secret>` (prompted). Redeploy, then sign up from the preview address.

## 7. Drill commands

See `DRILLS.md` (restore and rollback drills include the exact commands and the evidence each leaves).

## 8. Public cutover

`CUTOVER-RUNBOOK.md`. Not to be run before HD-06 approval evidence and real Turnstile keys exist.

## 9. Document screening and five-year retention: change set, then the hosted drill (Phase 2; added 2026-10-28, none of it has been run)

Read [MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md](MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md) and [RETENTION-ASSURANCE-2026-10-17.md](RETENTION-ASSURANCE-2026-10-17.md) first. Prerequisites: a scoped, non-root operator session (`aws sts get-caller-identity` shows an `assumed-role` ARN in account `166917387892`); CI green on the exact commit including the `image` job; the `release-image` workflow has produced the app and migrate digests (item 5). Do the whole sequence in the disposable **S-1** environment first (`ENVIRONMENT=s1`; its app stack is named `knest-s1`, so substitute that for `knest-production-app` in the commands below), then production. Nothing below deletes data; steps 2 and 3 only read.

0. **Upload the template.** `infra/cfn/app.yaml` is about 64 KB, over CloudFormation's 51,200-byte limit for a template passed inline (`--template-body`), and under the 1 MB limit for one passed by S3 URL (AWS documentation, "Understand CloudFormation quotas", checked 2026-10-28). A test (`infra/cfn/release-gates.test.ts`) fails if a runbook passes an oversized template inline. CloudFormation reads the object with the caller's permissions, which is why the operator policy has a `TemplateBucket` statement (read and write, no delete).
   - **Once, by the account owner (this creates a bucket):** a private template bucket with Block Public Access and versioning on. Templates hold no secrets (they refer to Secrets Manager by name) but describe the infrastructure, so keep it private. For S-1 use `knest-s1-templates-166917387892`, which the S-1 operator policy already covers, and delete it at teardown.
     ```
     aws s3api create-bucket --bucket knest-templates-166917387892 --region ap-south-1 --create-bucket-configuration LocationConstraint=ap-south-1
     aws s3api put-public-access-block --bucket knest-templates-166917387892 --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
     aws s3api put-bucket-versioning --bucket knest-templates-166917387892 --versioning-configuration Status=Enabled
     ```
   - **Each release, by the operator:** upload the template of the commit being released (the file name carries the commit so an old object is never overwritten).
     ```
     SHA=$(git rev-parse --short HEAD)
     aws s3 cp infra/cfn/app.yaml s3://knest-templates-166917387892/knest/app-$SHA.yaml --region ap-south-1
     ```
1. Validate and lint the template (the first command reads the uploaded object; the second is local):
   ```
   aws cloudformation validate-template --template-url https://knest-templates-166917387892.s3.ap-south-1.amazonaws.com/knest/app-<short-sha>.yaml --region ap-south-1
   node scripts/render-cfn.mjs s1 app > /tmp/app-s1.yaml && cfn-lint infra/cfn/*.yaml /tmp/app-s1.yaml
   ```
2. Create a change set **without executing it**. Set `LogRetentionDays` explicitly: the `UsePreviousValue=true` pattern in item 5 would keep the stored value of 7 and silently skip the five-year log retention.
   ```
   KEYS=$(aws cloudformation describe-stacks --stack-name knest-production-app --query 'Stacks[0].Parameters[].ParameterKey' --output text | tr '\t' '\n' | grep -v '^LogRetentionDays$' | awk '{printf "ParameterKey=%s,UsePreviousValue=true ",$1}')
   aws cloudformation create-change-set --stack-name knest-production-app --change-set-name release-screening \
     --template-url https://knest-templates-166917387892.s3.ap-south-1.amazonaws.com/knest/app-<short-sha>.yaml --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM \
     --parameters $KEYS ParameterKey=LogRetentionDays,ParameterValue=1827
   ```
3. Read the change set. Expected: **31 additions** (`DocumentsKey`, `DocumentsKeyAlias`, `QuarantineBucket`, `QuarantineBucketPolicy`, `DocumentsBucket`, `DocumentsBucketPolicy`, `GuardDutyMalwareRole`, `GuardDutyMalwarePolicy`, `MalwareProtectionPlan`, `ScanResultQueue`, `ScanResultDeadLetterQueue`, the two queue policies, `ScanResultRule`, `GuardDutyStatusRule`, `GuardDutyPostScanRule`, `AlertTopicPolicy`, `InstanceDocumentsPolicy`, four `Config…` SSM parameters, two metric filters and seven alarms), `DeployDocument` modified (it now writes four more variables into the app environment file), and the log group's retention modified. **No `Replace` or `Remove` of `Database`, `Bucket`, `LogGroup`, `AppInstance` or `InstanceRole`.** Stop if the list differs.
   ```
   aws cloudformation describe-change-set --stack-name knest-production-app --change-set-name release-screening \
     --query 'Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType,Replacement]' --output text
   ```
4. Execute only after review (a human decision, not a script step). If `MalwareProtectionPlan` fails to create, CloudFormation rolls the stack back and nothing depends on it yet.
   ```
   aws cloudformation execute-change-set --stack-name knest-production-app --change-set-name release-screening
   ```
5. Confirm the protection plan is `ACTIVE`, then redeploy the application digests (item 5, step 3) so the host picks up the four new settings. The application refuses to start without them, which is the intended failure mode.
   ```
   aws cloudformation describe-stacks --stack-name knest-production-app --query "Stacks[0].Outputs[?OutputKey=='MalwareProtectionPlanId'].OutputValue" --output text
   aws guardduty get-malware-protection-plan --region ap-south-1 --malware-protection-plan-id <id from the line above> --query Status
   ```
6. Run the hosted drill. The first command is a **dry run that prints the plan and writes nothing**; `--apply` writes two objects (the standard EICAR test string and a harmless PDF) under `malware-drill/` in the quarantine bucket and deletes them again. It runs on the host through SSM with the instance role and touches no database row.
   ```
   AWS_DEFAULT_REGION=ap-south-1 ENVIRONMENT=s1 bash scripts/ops/malware-drill-remote.sh <migrate-image-uri@sha256:...>
   AWS_DEFAULT_REGION=ap-south-1 ENVIRONMENT=s1 bash scripts/ops/malware-drill-remote.sh <migrate-image-uri@sha256:...> --apply
   ```
   Pass means all eight checks print PASS, the application log shows two `malware_scan_drill` lines (delivery through EventBridge and SQS), the scan-results queue is empty afterwards and the dead-letter queue has nothing new. Any FAIL means real protection is **not** proved: do not accept uploads.
7. Re-run the signed-in smoke test (item 1); its PDF upload now has to pass screening before staff can download it. Then collect the retention evidence (exit code 1 is expected: it reports what the owner still has to approve):
   ```
   node scripts/ops/retention-evidence.mjs --profile <verified-scoped-role-profile> --stack knest-production-app > work/retention-evidence.json
   ```
   Expected: `logPreservation: "five-year-floor"`, `archiveTransition: "five-year-archive-transition"`, no gap about 128 KB.
8. Cost check after the first week of real traffic: the Mumbai GuardDuty rate is unpublished, so read the first bill line for `GuardDuty` and compare it with the reference rates in `AWS-DEPLOYMENT-COST-PLAN-2026-10-27.md` section 3.
