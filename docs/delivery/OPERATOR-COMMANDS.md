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
2. Update the app stack template (adds the runtime-role secret, the dead-mail alarm), reviewed as a change set:
   ```
   aws cloudformation create-change-set --stack-name knest-production-app --change-set-name release-r1 \
     --template-body file://infra/cfn/app.yaml --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM \
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
