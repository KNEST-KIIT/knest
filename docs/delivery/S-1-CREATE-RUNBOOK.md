# S-1 first-time create, update and verify runbook

Date: 2026-10-29. Status: **written, NOT RUN.** Nothing in AWS, GitHub, DNS or production was touched while writing it. The Phase B teardown utility `scripts/s1-teardown.mjs` is written and tested locally only; **nothing is installed in AWS yet** (no scheduler role, schedule group or schedule exists). This is the only runbook for the first-ever S-1 environment. [OPERATOR-COMMANDS.md](OPERATOR-COMMANDS.md) item 9 is the **production** update sequence and must not be used for S-1: it uploads the raw `infra/cfn/app.yaml` (which keeps the database snapshot and retains buckets, keys and log group on delete), it has no CREATE sequence, it names the production template bucket, it passes no `--role-arn`, and it reuses production names.

Read first: [S-1-PREFLIGHT.md](S-1-PREFLIGHT.md) (conditions, cost ceiling), [S-1-SPEC.md](S-1-SPEC.md) (what the spike must prove), `infra/s1/teardown-roles.json` (the two teardown roles), `scripts/s1-teardown.mjs` (the Phase B utility that installs the four expiry schedules) and [MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md](MALWARE-PROTECTION-ARCHITECTURE-2026-10-27.md).

## 0. Rules that apply to every step

1. **Rendered templates only.** Every template is produced by `node scripts/render-cfn.mjs s1 <name>`. The S-1 rendering deletes the database without a final snapshot and deletes the buckets, key, log group and registry with the stack; the raw files do the opposite. A raw template is never uploaded.
2. **CREATE change sets with the service role, reviewed before execute.** Each new stack is made with `create-change-set --change-set-type CREATE --role-arn arn:aws:iam::166917387892:role/knest-s1-cfn-service`, read with `describe-change-set`, and executed only after a person has read it. `create-stack` and `update-stack` are not used. The one update (section 8) is an UPDATE change set under the same rules.
3. **No secret value in a file or in shell history.** Values you type go to a `read` prompt (the prompt is not recorded in history; `-s` also hides what you type). Commands refer to shell variables, never to a literal. The Turnstile secret key is pasted by the account owner into the Secrets Manager console and nowhere else. Do not use `echo`, `set -x`, `--secret-string`, `--debug` or a here-document with these values, and do not paste outputs of `get-secret-value` anywhere (the operator policy denies it).
4. **Read-only first.** Sections 2 and 3 create nothing in AWS except the private template bucket and the template objects in it. No stack exists before section 4.
5. **Mumbai (`ap-south-1`) except the web ACL**, which must be in `us-east-1`. Compute and databases outside Mumbai are denied by the operator policy.
6. **Stop on any surprise.** A change set with anything other than `Add`, a stack in `ROLLBACK_*` or `*_FAILED`, a price above plan: stop, tear down what exists (section 12), and report. Do not patch around it.

## 1. Fixed values

| Name | Value |
|---|---|
| Account | `166917387892` |
| Stacks (create order) | `knest-s1-waf` (us-east-1), `knest-s1-ci`, `knest-s1`, `knest-s1-edge`; then an UPDATE of `knest-s1` |
| CloudFormation service role | `arn:aws:iam::166917387892:role/knest-s1-cfn-service` |
| Template bucket | `knest-s1-templates-166917387892`, private, versioned, Mumbai (created once by the account owner; section 3) |
| Registry | `knest-s1-app` (never the production registry name) |
| GitHub Environment | `s1` (OIDC trust is `repo:<repository>:environment:s1`) |
| Secret read by the edge stack | `knest-s1/origin-verify` (nothing else) |

Shell setup, once per terminal (Git Bash; `aws login --profile knest-s1` first, see S-1-PREFLIGHT section 2):

```bash
export MSYS_NO_PATHCONV=1 AWS_PROFILE=knest-s1 AWS_DEFAULT_REGION=ap-south-1 AWS_PAGER=""
ACCOUNT=166917387892
CFN_ROLE=arn:aws:iam::166917387892:role/knest-s1-cfn-service
TPL_BUCKET=knest-s1-templates-166917387892
TPL_URL=https://knest-s1-templates-166917387892.s3.ap-south-1.amazonaws.com
SHA=$(git rev-parse --short=12 HEAD)
OUT=work/s1-rendered-$SHA
```

`SHA` must be the commit that was pushed and that GitHub CI passed (the release workflow checks the exact SHA). Run `git status --porcelain` first; it must print nothing. `work/` is not ignored by git: never `git add` it.

## 2. Hard blockers (nothing in section 4 or later may start until every row is satisfied)

| # | Blocker | Who | Satisfied when |
|---|---|---|---|
| B0 | **Automated teardown is installed and verified (Phase B utility).** Prerequisite, in this order: (1) `plan` (no AWS call), (2) explicitly authorised root bootstrap `install`, (3) `verify`. Root is rejected unless `--allow-root-bootstrap` is present. **Do not execute any S-1 CREATE change set until all four schedules and both regional schedule groups pass `verify`.** Creating (not executing) a change set is allowed because it creates no resources, only an empty `REVIEW_IN_PROGRESS` stack. The utility is written and tested locally; nothing is installed in AWS yet. | Owner (install); operator (plan, verify) | `verify` prints `PASS` for `knest-s1-scheduler`, the group `knest-s1` in `ap-south-1` and in `us-east-1`, and the four schedules `knest-s1-expire-edge`, `knest-s1-expire-app`, `knest-s1-expire-ci` (`ap-south-1`) and `knest-s1-expire-waf` (`us-east-1`); the read-only checks below agree |
| B1 | Explicitly authorised root bootstrap session in account `166917387892`; all stack resource operations are delegated to `knest-s1-cfn-service`; a budget named `knest-s1` has alerts at 50, 80 and 100 percent of USD 25 and a forecast alert (G1, G3) | Owner | `aws sts get-caller-identity --profile claude-deploy` shows account `166917387892` and the root ARN; every change set and delete passes `--role-arn "$CFN_ROLE"`; `aws budgets describe-budgets` lists `knest-s1` |
| B2 | **Turnstile site key and secret key.** A real Cloudflare Turnstile widget. The site key is public and goes into the stack; the secret key is pasted into `knest-s1/turnstile-secret` in the Secrets Manager console by the owner after section 6 and before section 9. No placeholder or test key | Owner | Site key in hand; owner attests in `EVIDENCE/S-1.md` that the secret has a current version (the operator cannot read S-1 secret metadata, by design, so this is an attestation, not a command) |
| B3 | **`EmailFromAddress` is verified in SES (Mumbai).** An address or a domain identity with `VerifiedForSendingStatus` true. SES is outside the operator policy | Owner | Owner shows `aws sesv2 get-email-identity --region ap-south-1 --email-identity <identity> --query VerifiedForSendingStatus` is `true` (run with an administrator profile) |
| B4 | **`AlertEmail`** is a mailbox someone reads. The SNS subscription stays `PendingConfirmation` until they click the confirmation link, so no alarm reaches anyone before that | Owner | Subscription confirmed (`aws sns list-subscriptions-by-topic` shows an ARN, not `PendingConfirmation`) |
| B5 | **`AccessHash`** is a real 64-character SHA-256 digest. Empty means the site is public, and S-1 holds test data behind an HTTP-only origin: it is never public | Owner chooses the credentials | Section 3.3 prints `gate digest ready` |
| B6 | **`ExpiresOn`** is a date (YYYY-MM-DD) no more than 7 days after creation and the same value passed to `plan`, `install` and `verify` of the B0 utility (`install` refuses a later date). The preflight's 14-day backstop is no longer affordable (section 10) | Owner | Matches the four schedule expressions read in the check below |
| B7 | The GitHub Environment `s1` exists, the commit is pushed and its exact-SHA CI run passed, and the template bucket exists with Block Public Access and versioning on | Owner | Section 3 checks pass |
| B8 | The service role carries the policies of `infra/s1/teardown-roles.json` and `infra/iam/cfn-service-role-s1-screening.json` (which now includes the read of `knest-s1/origin-verify` the edge stack needs) | Owner | Check below |

**B0 sequence.** The executable `plan`, `install` and `verify` commands are in section 3.3a, after the section 3.3 prompt that sets `$EXPIRES_ON`. Nothing runs here.

Read-only checks for B0 and B8 (all allowed by the operator policy). The schedule checks name `edge`, `app` and `ci` in `ap-south-1` and `waf` in `us-east-1`:

```bash
aws sts get-caller-identity --query '[Account,Arn]' --output text
aws iam get-role --role-name knest-s1-cfn-service --query 'Role.Arn' --output text
for P in $(aws iam list-role-policies --role-name knest-s1-cfn-service --query 'PolicyNames[]' --output text); do aws iam get-role-policy --role-name knest-s1-cfn-service --policy-name "$P" --query "PolicyDocument.Statement[?Sid=='ReadTheS1OriginVerifySecretForTheEdgeStack'].Resource" --output text; done
aws iam list-attached-role-policies --role-name knest-s1-cfn-service --query 'AttachedPolicies[].PolicyName' --output text
aws scheduler list-schedules --region ap-south-1 --group-name knest-s1 --query 'Schedules[].[Name,State]' --output text
aws scheduler list-schedules --region us-east-1 --group-name knest-s1 --query 'Schedules[].[Name,State]' --output text
aws scheduler get-schedule --region ap-south-1 --group-name knest-s1 --name knest-s1-expire-edge --query '[State,ScheduleExpression,ActionAfterCompletion]' --output text
aws scheduler get-schedule --region ap-south-1 --group-name knest-s1 --name knest-s1-expire-app --query '[State,ScheduleExpression,ActionAfterCompletion]' --output text
aws scheduler get-schedule --region ap-south-1 --group-name knest-s1 --name knest-s1-expire-ci --query '[State,ScheduleExpression,ActionAfterCompletion]' --output text
aws scheduler get-schedule --region us-east-1 --group-name knest-s1 --name knest-s1-expire-waf --query '[State,ScheduleExpression,ActionAfterCompletion]' --output text
aws budgets describe-budgets --account-id 166917387892 --query 'Budgets[].BudgetName' --output text
```

Expected: the authorised account/ARN; the role ARN; the origin-verify resource ARN printed once (from an inline policy; if the policy is attached as a managed policy, read it with `aws iam get-policy-version` instead); one group per region holding exactly its schedules (three in `ap-south-1`, one in `us-east-1`); all four schedules `ENABLED`, `ActionAfterCompletion` `DELETE`, with `at(ExpiresOnT00:00:00)` for edge, `at(ExpiresOnT02:00:00)` for WAF and `at(ExpiresOnT04:00:00)` for app and CI; a budget list containing `knest-s1`. Any empty or missing line is a blocker.

## 3. Read-only discovery, inputs and rendering (creates nothing in AWS except the template objects)

**3.1 GitHub OIDC provider.** Only one GitHub provider may exist per account. Reuse it if it is there; never create a second.

```bash
OIDC_ARN=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?ends_with(Arn, ':oidc-provider/token.actions.githubusercontent.com')].Arn | [0]" --output text)
echo "$OIDC_ARN"
if [ "$OIDC_ARN" = "None" ]; then
  OIDC_PARAMS="ParameterKey=CreateOidcProvider,ParameterValue=true"
else
  aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" --query '{Url:Url,ClientIDList:ClientIDList}'
  OIDC_PARAMS="ParameterKey=CreateOidcProvider,ParameterValue=false ParameterKey=ExistingOidcProviderArn,ParameterValue=$OIDC_ARN"
fi
```

If a provider exists, its `ClientIDList` must contain `sts.amazonaws.com`; if it does not, stop (the S-1 roles cannot change it, and the roles would not be assumable). A reused provider is never deleted by S-1 teardown; one that S-1 creates is deleted with `knest-s1-ci`. Also ask whoever administers the GitHub repository whether it uses the immutable OIDC subject; if it does, the ci stack needs `GitHubSubjectPrefix` (see `infra/cfn/ci.yaml`), otherwise the push role is never assumable. The default repository is `KNEST-KIIT/knest`.

**3.2 CloudFront prefix list** (Mumbai). The origin security group admits only this list.

```bash
PL_ID=$(aws ec2 describe-managed-prefix-lists --region ap-south-1 --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing --query 'PrefixLists[0].PrefixListId' --output text)
[[ "$PL_ID" == pl-* ]] && echo "prefix list $PL_ID" || echo "STOP: no CloudFront origin-facing prefix list found"
```

**3.3 Inputs.** Typed at prompts, so nothing is recorded. The site key, address and date are not secret; the gate credentials are.

```bash
read -rp 'Turnstile SITE key (public): ' TURNSTILE_SITE_KEY
read -rp 'SES-verified From address (blocker B3): ' EMAIL_FROM
read -rp 'Alert e-mail address (blocker B4): ' ALERT_EMAIL
read -rp 'ExpiresOn, YYYY-MM-DD, at most 7 days from today (blocker B6): ' EXPIRES_ON
read -rsp 'Gate credentials as user:password (hidden, not stored): ' GATE_CRED; echo
ACCESS_HASH=$(printf '%s' "$GATE_CRED" | sha256sum | cut -d' ' -f1); unset GATE_CRED
for V in TURNSTILE_SITE_KEY EMAIL_FROM ALERT_EMAIL EXPIRES_ON PL_ID; do [ -n "${!V}" ] || echo "STOP: $V is empty"; done
[[ "$EXPIRES_ON" =~ ^20[0-9]{2}-[0-9]{2}-[0-9]{2}$ ]] || echo "STOP: ExpiresOn must be YYYY-MM-DD"
[[ "$ACCESS_HASH" =~ ^[0-9a-f]{64}$ ]] && echo "gate digest ready" || echo "STOP: no gate digest"
```

**3.3a B0 teardown sequence.** `$EXPIRES_ON` was typed once at the 3.3 prompt above (that prompt creates nothing). It must be a future date at most 7 days away, and 00:00 UTC on that date must not have passed. Run this before any `create-change-set`.

```bash
node scripts/s1-teardown.mjs plan --expires-on "$EXPIRES_ON"
node scripts/s1-teardown.mjs install --expires-on "$EXPIRES_ON" --profile claude-deploy --allow-root-bootstrap
node scripts/s1-teardown.mjs verify --expires-on "$EXPIRES_ON" --profile claude-deploy --allow-root-bootstrap
```

`plan` makes no AWS call and prints the role, the two groups and the four schedules for review. `install` is **owner/root bootstrap only** and requires the explicit `--allow-root-bootstrap` switch: it creates the `knest-s1-scheduler` role and its inline policy, the schedule group `knest-s1` in `ap-south-1` and in `us-east-1`, and four one-time schedules, and it refuses to continue if a resource of the same name exists with different content. If the first schedule creation sees transient IAM propagation failure, wait one minute and rerun the same idempotent `install`; never loosen the role. `verify` is read-only and exact; it needs `knest-s1-cfn-service` to exist already (B8). The schedules fire in three steps: `knest-s1-expire-edge` at **00:00 UTC**, `knest-s1-expire-waf` at **02:00 UTC** after CloudFront has released the web ACL, then `knest-s1-expire-app` and `knest-s1-expire-ci` at **04:00 UTC**. Each schedule is created with `ActionAfterCompletion` `DELETE`, so it removes itself after it runs: run `verify` before 00:00 UTC on `ExpiresOn`; after that it reports the missing schedules. The schedules have bounded retries but no dead-letter queue; the release monitor and owner must check stack status after every stage and treat `DELETE_FAILED` as an incident. The schedules delete stacks only; **they do not empty buckets** (section 12 does that, before 00:00 UTC), so a non-empty S-1 bucket makes its stack delete fail.

The owner keeps the gate credentials in a password manager. The digest is derived, not the password, but it can be brute-forced offline if the password is weak: choose a long one. The edge parameter `AccessHash` is `NoEcho`, so CloudFormation masks it in describe output.

**3.4 Template bucket (owner, once).** Skip if it exists; check with `aws s3api get-bucket-versioning --bucket knest-s1-templates-166917387892`.

```bash
aws s3api create-bucket --bucket knest-s1-templates-166917387892 --region ap-south-1 --create-bucket-configuration LocationConstraint=ap-south-1
aws s3api put-public-access-block --bucket knest-s1-templates-166917387892 --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket knest-s1-templates-166917387892 --versioning-configuration Status=Enabled
```

**3.5 Render, lint, upload.** `edge` and `waf` have no deletion-policy lines, so their rendering equals the source, but they go through the same command so there is one rule.

```bash
mkdir -p "$OUT"
node scripts/render-cfn.mjs s1 waf > "$OUT/waf.yaml"
node scripts/render-cfn.mjs s1 ci > "$OUT/ci.yaml"
node scripts/render-cfn.mjs s1 app > "$OUT/app.yaml"
node scripts/render-cfn.mjs s1 edge > "$OUT/edge.yaml"
grep -nE '(DeletionPolicy|UpdateReplacePolicy): (Retain|Snapshot)' "$OUT"/*.yaml && echo "STOP: a rendered template still retains data" || echo "no retained resource in any S-1 rendering"
grep -c 'ExpiredObjectDeleteMarker: true' "$OUT/app.yaml"
cfn-lint "$OUT"/*.yaml
for T in ci app edge; do aws s3 cp "$OUT/$T.yaml" "s3://$TPL_BUCKET/knest-s1/$T-$SHA.yaml" --region ap-south-1; done
aws cloudformation validate-template --region ap-south-1 --template-url "$TPL_URL/knest-s1/app-$SHA.yaml" --query 'Parameters[].ParameterKey' --output text
```

Expected: the `grep` for retained data prints nothing and then the message; the delete-marker count is `2` (the quarantine bucket's rule and the documents bucket's S-1 rule); `cfn-lint` is clean. The web ACL template is 4 KB, below CloudFormation's 51,200-byte inline limit, so it is passed from the rendered file in us-east-1 instead of from the Mumbai bucket (a cross-region template URL has not been verified here); `ci`, `app` and `edge` go by URL from the private versioned bucket. If you change the commit, re-render under a new `SHA`; an uploaded object is never overwritten.

## 4. Stack 1: `knest-s1-waf` (us-east-1)

```bash
aws cloudformation create-change-set --region us-east-1 --stack-name knest-s1-waf --change-set-name create-waf-$SHA --change-set-type CREATE \
  --template-body file://$OUT/waf.yaml --role-arn "$CFN_ROLE" \
  --parameters ParameterKey=Environment,ParameterValue=s1
aws cloudformation wait change-set-create-complete --region us-east-1 --stack-name knest-s1-waf --change-set-name create-waf-$SHA
aws cloudformation describe-change-set --region us-east-1 --stack-name knest-s1-waf --change-set-name create-waf-$SHA \
  --query '{Status:Status,Reason:StatusReason,Execution:ExecutionStatus,Changes:Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType]}' --output json
```

Review: `Status` `CREATE_COMPLETE`, `Execution` `AVAILABLE`, exactly one change: `Add WebAcl AWS::WAFv2::WebACL`. A person reads it, then:

```bash
node scripts/s1-teardown.mjs verify --expires-on "$EXPIRES_ON" --profile claude-deploy --allow-root-bootstrap || exit 1
aws cloudformation execute-change-set --region us-east-1 --stack-name knest-s1-waf --change-set-name create-waf-$SHA
aws cloudformation wait stack-create-complete --region us-east-1 --stack-name knest-s1-waf
WEB_ACL_ARN=$(aws cloudformation describe-stacks --region us-east-1 --stack-name knest-s1-waf --query "Stacks[0].Outputs[?OutputKey=='WebAclArn'].OutputValue" --output text)
```

## 5. Stack 2: `knest-s1-ci` (registry and CI roles), then the GitHub variables

`RepositoryName` is passed explicitly because its default is the production registry name; the S-1 push role, the operator policy and the service role all name `knest-s1-app`.

```bash
aws cloudformation create-change-set --stack-name knest-s1-ci --change-set-name create-ci-$SHA --change-set-type CREATE \
  --template-url "$TPL_URL/knest-s1/ci-$SHA.yaml" --capabilities CAPABILITY_NAMED_IAM --role-arn "$CFN_ROLE" \
  --parameters ParameterKey=Environment,ParameterValue=s1 ParameterKey=RepositoryName,ParameterValue=knest-s1-app $OIDC_PARAMS
aws cloudformation wait change-set-create-complete --stack-name knest-s1-ci --change-set-name create-ci-$SHA
aws cloudformation describe-change-set --stack-name knest-s1-ci --change-set-name create-ci-$SHA \
  --query '{Status:Status,Reason:StatusReason,Execution:ExecutionStatus,Changes:Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType]}' --output json
```

Review: all `Add`; `Repository` (`AWS::ECR::Repository`), `PushRole`, `DeployRole`, and `OidcProvider` only if section 3.1 found none. Then execute and read the outputs:

```bash
aws cloudformation execute-change-set --stack-name knest-s1-ci --change-set-name create-ci-$SHA
aws cloudformation wait stack-create-complete --stack-name knest-s1-ci
aws cloudformation describe-stacks --stack-name knest-s1-ci --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output text
PUSH_ROLE_ARN=$(aws cloudformation describe-stacks --stack-name knest-s1-ci --query "Stacks[0].Outputs[?OutputKey=='PushRoleArn'].OutputValue" --output text)
DEPLOY_ROLE_ARN=$(aws cloudformation describe-stacks --stack-name knest-s1-ci --query "Stacks[0].Outputs[?OutputKey=='DeployRoleArn'].OutputValue" --output text)
```

**GitHub variables** (a person with admin rights on the repository; not the AWS operator session; none of these values is secret). Create the Environment first if it does not exist:

```bash
gh api -X PUT repos/KNEST-KIIT/knest/environments/s1
gh variable set AWS_REGION --env s1 --repo KNEST-KIIT/knest --body ap-south-1
gh variable set AWS_PUSH_ROLE_ARN --env s1 --repo KNEST-KIIT/knest --body "$PUSH_ROLE_ARN"
gh variable set AWS_DEPLOY_ROLE_ARN --env s1 --repo KNEST-KIIT/knest --body "$DEPLOY_ROLE_ARN"
gh variable set ECR_REPOSITORY --env s1 --repo KNEST-KIIT/knest --body knest-s1-app
gh variable list --env s1 --repo KNEST-KIIT/knest
```

The last command must list exactly these four, with `ECR_REPOSITORY` equal to `knest-s1-app`. The production Environment keeps its own, different repository.

## 6. Stack 3: `knest-s1` (application) with a placeholder `SiteUrl`

The site address is the CloudFront name, which does not exist until the edge stack does, and the edge stack needs this stack's host name. That is the circle: create this stack with a placeholder, create the edge, then update only `SiteUrl` (section 8). The placeholder is never deployed to the host: the release (section 9) runs after the update.

```bash
aws cloudformation create-change-set --stack-name knest-s1 --change-set-name create-app-$SHA --change-set-type CREATE \
  --template-url "$TPL_URL/knest-s1/app-$SHA.yaml" --capabilities CAPABILITY_NAMED_IAM --role-arn "$CFN_ROLE" \
  --parameters ParameterKey=Environment,ParameterValue=s1 ParameterKey=CloudFrontPrefixListId,ParameterValue=$PL_ID \
  ParameterKey=EcrRepositoryName,ParameterValue=knest-s1-app ParameterKey=SiteUrl,ParameterValue=https://placeholder.invalid \
  ParameterKey=EmailFromAddress,ParameterValue=$EMAIL_FROM ParameterKey=TurnstileSiteKey,ParameterValue=$TURNSTILE_SITE_KEY \
  ParameterKey=AlertEmail,ParameterValue=$ALERT_EMAIL ParameterKey=ExpiresOn,ParameterValue=$EXPIRES_ON ParameterKey=LogRetentionDays,ParameterValue=7
aws cloudformation wait change-set-create-complete --stack-name knest-s1 --change-set-name create-app-$SHA
aws cloudformation describe-change-set --stack-name knest-s1 --change-set-name create-app-$SHA \
  --query '{Status:Status,Reason:StatusReason,Execution:ExecutionStatus,Parameters:Parameters[].[ParameterKey,ParameterValue],Changes:Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType]}' --output json
```

Notes on the parameters: `EcrRepositoryName` defaults to the production registry and is what the instance role's pull permission names, so omitting it leaves the host unable to pull; `LogRetentionDays` is 7 for the disposable stack (production keeps 1827; the log group is deleted with the stack); `ArchiveDocumentsAfterDays` has no effect in S-1; the AMI is resolved from the public parameter `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64` (the operator policy allows exactly that read).

Review: every change is `Add`; the list includes `Database`, `Bucket`, `QuarantineBucket`, `DocumentsBucket`, `DocumentsKey`, `MalwareProtectionPlan`, `OriginVerifySecret`, `TurnstileSecret`, `AppInstance`, `DeployDocument`; `Parameters` shows the S-1 values and the placeholder `SiteUrl`; no `Replace`, no `Remove`. Then execute (RDS and the instance take about 10 to 15 minutes):

```bash
aws cloudformation execute-change-set --stack-name knest-s1 --change-set-name create-app-$SHA
aws cloudformation wait stack-create-complete --stack-name knest-s1
ORIGIN_DNS=$(aws cloudformation describe-stacks --stack-name knest-s1 --query "Stacks[0].Outputs[?OutputKey=='InstancePublicDnsName'].OutputValue" --output text)
PLAN_ID=$(aws cloudformation describe-stacks --stack-name knest-s1 --query "Stacks[0].Outputs[?OutputKey=='MalwareProtectionPlanId'].OutputValue" --output text)
echo "$ORIGIN_DNS"
```

`ORIGIN_DNS` must be an `ec2-...compute.amazonaws.com` name.

**Owner action now (blocker B2):** in the AWS console, Secrets Manager, secret `knest-s1/turnstile-secret`, "Retrieve secret value", Edit, paste the Turnstile **secret key**, Save. It was created empty. The release (section 9) cannot be repeated for this commit, so it must be set before section 9.

## 7. Stack 4: `knest-s1-edge` (CloudFront, function, access gate)

S-1 uses an HTTP origin on the application port (the template allows `http-only` for S-1 only): the `X-Origin-Verify` header crosses the AWS network unencrypted. That is the known S-1 limitation recorded in `edge.yaml`; production uses the HTTPS load balancer.

```bash
aws cloudformation create-change-set --stack-name knest-s1-edge --change-set-name create-edge-$SHA --change-set-type CREATE \
  --template-url "$TPL_URL/knest-s1/edge-$SHA.yaml" --role-arn "$CFN_ROLE" \
  --parameters ParameterKey=Environment,ParameterValue=s1 ParameterKey=OriginDomainName,ParameterValue=$ORIGIN_DNS \
  ParameterKey=OriginPort,ParameterValue=3000 ParameterKey=OriginProtocol,ParameterValue=http-only \
  ParameterKey=OriginVerifySecretId,ParameterValue=knest-s1/origin-verify ParameterKey=WebAclArn,ParameterValue=$WEB_ACL_ARN \
  ParameterKey=AccessHash,ParameterValue=$ACCESS_HASH
aws cloudformation wait change-set-create-complete --stack-name knest-s1-edge --change-set-name create-edge-$SHA
aws cloudformation describe-change-set --stack-name knest-s1-edge --change-set-name create-edge-$SHA \
  --query '{Status:Status,Reason:StatusReason,Execution:ExecutionStatus,Parameters:Parameters[].[ParameterKey,ParameterValue],Changes:Changes[].ResourceChange.[Action,LogicalResourceId,ResourceType]}' --output json
```

Review: `Add` of `ViewerRequestFunction`, `SecurityHeaders`, `StaticAssetsCachePolicy`, `Distribution` only; `AccessHash` shows `****`; `OriginProtocol` is `http-only` and the origin is the host from section 6. The stack resolves `{{resolve:secretsmanager:knest-s1/origin-verify:SecretString}}` with the service role's single `GetSecretValue` permission. Execute (a CloudFront distribution takes 5 to 15 minutes):

```bash
aws cloudformation execute-change-set --stack-name knest-s1-edge --change-set-name create-edge-$SHA
aws cloudformation wait stack-create-complete --stack-name knest-s1-edge
DIST_DOMAIN=$(aws cloudformation describe-stacks --stack-name knest-s1-edge --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" --output text)
echo "$DIST_DOMAIN"
```

**Owner action (blocker B2):** add `$DIST_DOMAIN` (the `...cloudfront.net` name printed above) to the allowed hostnames of the Turnstile widget in the Cloudflare dashboard. The widget had to exist before this name did.

## 8. Update `knest-s1`: set the real `SiteUrl` (UPDATE change set)

Everything except `SiteUrl` keeps its stored value.

```bash
KEYS=$(aws cloudformation describe-stacks --stack-name knest-s1 --query 'Stacks[0].Parameters[].ParameterKey' --output text | tr '\t' '\n' | grep -v '^SiteUrl$' | awk '{printf "ParameterKey=%s,UsePreviousValue=true ",$1}')
aws cloudformation create-change-set --stack-name knest-s1 --change-set-name siteurl-$SHA --change-set-type UPDATE \
  --template-url "$TPL_URL/knest-s1/app-$SHA.yaml" --capabilities CAPABILITY_NAMED_IAM --role-arn "$CFN_ROLE" \
  --parameters $KEYS ParameterKey=SiteUrl,ParameterValue=https://$DIST_DOMAIN
aws cloudformation wait change-set-create-complete --stack-name knest-s1 --change-set-name siteurl-$SHA
aws cloudformation describe-change-set --stack-name knest-s1 --change-set-name siteurl-$SHA \
  --query '{Status:Status,Reason:StatusReason,Execution:ExecutionStatus,Changes:Changes[].ResourceChange.[Action,LogicalResourceId,Replacement]}' --output json
```

Review: **exactly one change, `Modify ConfigSiteUrl`, replacement `False`.** If `AppInstance` (or anything else) appears, stop: the AMI parameter is re-read on every update, and a newer Amazon Linux image replaces the instance, which changes its DNS name and breaks the edge origin. Do not execute; delete the change set and report. Then:

```bash
aws cloudformation execute-change-set --stack-name knest-s1 --change-set-name siteurl-$SHA
aws cloudformation wait stack-update-complete --stack-name knest-s1
```

## 9. Pre-release gate, then dispatch the release exactly once

Image tags are immutable (`app-<sha>`, `migrate-<sha>`) and the host deploys only the digests the workflow prints. A second dispatch for the same commit is refused at the push, so there is one dispatch per commit and Environment. Before it, confirm in this order:

- B2 secret set by the owner (attested); B3, B4 satisfied; the edge and the real `SiteUrl` are in place (sections 7 and 8).
- `gh variable list --env s1 --repo KNEST-KIIT/knest` shows the four variables with `ECR_REPOSITORY` `knest-s1-app`.
- The host is online in SSM and has the deploy target tag:

```bash
aws ssm describe-instance-information --filters Key=tag:knest-deploy-target,Values=s1 --query 'InstanceInformationList[].[InstanceId,PingStatus]' --output text
```

It must print one instance with `Online`. Then, by a person who may run workflows (this builds, scans, pushes and deploys; the exact-SHA CI check and the image-scan gate inside it are unchanged):

```bash
gh workflow run release-image.yml --repo KNEST-KIIT/knest --ref <branch that holds the pushed commit> -f environment=s1 -f deploy=true
gh run list --repo KNEST-KIIT/knest --workflow release-image.yml --limit 1
gh run watch --repo KNEST-KIIT/knest <run id from the line above>
```

Record the run URL and both digests from the run summary in `EVIDENCE/S-1.md`. If `build-and-push` succeeded but `deploy` failed, **do not dispatch again**: send the digests from the first run's summary to the host with the deploy document:

```bash
aws ssm send-command --region ap-south-1 --document-name knest-s1-deploy --targets "Key=tag:knest-deploy-target,Values=s1" \
  --parameters "Environment=s1,AppImage=<app image from the summary>,MigrateImage=<migrate image from the summary>" --comment "manual S-1 deploy of the first run"
```

If the build itself failed before pushing, fix the cause and push a new commit (new `SHA`): re-render (section 3.5), upload and repeat from section 6 (a new commit needs new stacks only if the rendered templates changed; otherwise run an UPDATE change set as in section 8).

## 10. Cost: gross stop checks

The ceiling is USD 25 **gross, before credits**, and the stop line is a projected USD 20 (S-1-PREFLIGHT section 4). The preflight table (about USD 6 for 5 days, about USD 15 for 14) was written before the web ACL, six secrets, the document KMS key and the document-screening alarms were added. From [AWS-DEPLOYMENT-COST-PLAN-2026-10-27.md](AWS-DEPLOYMENT-COST-PLAN-2026-10-27.md) section 3 (WAF about USD 8.60 a month, secrets about USD 2.50, one KMS key USD 1.00), 14 days add about USD 5.6, which puts the old 14-day figure at about USD 20.6: at the stop line before alarms and GuardDuty. This is why `ExpiresOn` is at most 7 days. The Mumbai GuardDuty rate is unpublished; read the first bill line.

Run at each checkpoint (Cost Explorer lags about a day, so also count the resources you have created):

```bash
aws ce get-cost-and-usage --region us-east-1 --time-period Start=$(date -u -d '-2 days' +%F),End=$(date -u -d '+1 day' +%F) --granularity DAILY --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE --query 'ResultsByTime[].[TimePeriod.Start,Groups[].[Keys[0],Metrics.UnblendedCost.Amount]]' --output json
```

| Checkpoint | Do | Stop and tear down when |
|---|---|---|
| Before section 4 | Record the baseline (should be near zero) and the budget list | The account already shows S-1-like spend, or the `knest-s1` budget is missing |
| After section 6 | Note that RDS, EC2 and the public IPv4 address now bill hourly | Anything other than the stack's resources is running |
| After section 7 | Note the web ACL and the distribution | The projection below is not met |
| After section 9, then every day | Record the daily figure in `EVIDENCE/S-1.md` | **Spend to date plus (latest daily figure times the days left to `ExpiresOn`) reaches USD 20**, or a single day exceeds USD 4, or the budget sends its 80 percent (USD 20) notice |
| Any time | | A `GuardDuty` line appears that you cannot explain from the drill |

Stopping means section 12, not waiting for the schedule.

## 11. Verification

Run after section 9 succeeds. Record every result in `EVIDENCE/S-1.md`.

```bash
aws cloudformation describe-stacks --stack-name knest-s1 --query 'Stacks[0].StackStatus' --output text
aws cloudformation describe-stacks --region us-east-1 --stack-name knest-s1-waf --query 'Stacks[0].StackStatus' --output text
aws guardduty get-malware-protection-plan --region ap-south-1 --malware-protection-plan-id "$PLAN_ID" --query Status --output text
aws rds describe-db-instances --query 'DBInstances[?starts_with(DBInstanceIdentifier, `knest-s1`)].[PubliclyAccessible,DeletionProtection,StorageEncrypted]' --output text
aws ec2 describe-security-groups --filters Name=tag:Name,Values=knest-s1-app --query 'SecurityGroups[].IpPermissions[].PrefixListIds[].PrefixListId' --output text
```

Expected: `CREATE_COMPLETE` (or `UPDATE_COMPLETE`) for both; plan `ACTIVE`; `False False True` for the database; the app security group's only inbound source is `$PL_ID`.

Edge, gate and WAF (the gate password is typed at the prompt, not on the command line):

```bash
read -rsp 'Gate credentials, user:password: ' KNEST_VERIFY_BASIC; echo; export KNEST_VERIFY_BASIC
node scripts/verify-production.mjs --url https://$DIST_DOMAIN --gate --waf --origin http://$ORIGIN_DNS:3000 --evidence docs/delivery/EVIDENCE/S-1-verify-$(date +%F).md
unset KNEST_VERIFY_BASIC
```

Expected: all PASS, 401 without credentials, the direct request to the origin refused. Then the host checks (migrate image digest from the run summary):

```bash
ENVIRONMENT=s1 AWS_DEFAULT_REGION=ap-south-1 bash scripts/ops/hosted-smoke-remote.sh <migrate image@sha256:...>
ENVIRONMENT=s1 AWS_DEFAULT_REGION=ap-south-1 bash scripts/ops/malware-drill-remote.sh <migrate image@sha256:...>
ENVIRONMENT=s1 AWS_DEFAULT_REGION=ap-south-1 bash scripts/ops/malware-drill-remote.sh <migrate image@sha256:...> --apply
```

The first drill command is a dry run that writes nothing. Pass criteria are those of OPERATOR-COMMANDS item 9, step 6. Any FAIL means real protection is not proved. The smoke test deletes documents it creates, which leaves delete markers in the documents bucket; the S-1 lifecycle rule `s1-remove-lone-delete-markers` removes them once their versions have expired, so they do not block teardown.

## 12. Teardown and residual cleanup

Order: empty the data buckets first (12.1), then the stacks go (12.2), then the inventory and refusal gate, then the utility cleanup (12.3). The automated schedules delete stacks only; **they do not empty buckets**, and a non-empty S-1 bucket makes its stack delete fail.

### 12.1 Data residual cleanup (before any stack deletion, automated or manual)

**Buckets.** Lifecycle rules empty the S-1 buckets one to three days after the last write, and `s1-remove-lone-delete-markers` clears the delete markers they and smoke tests leave. Anything written in the last days is still there at teardown, so empty versions and delete markers first, before 00:00 UTC on `ExpiresOn` or before a manual delete. List before deleting (the operator holds `s3:*` on `knest-s1-*` only):

```bash
for B in knest-s1-documents-$ACCOUNT knest-s1-quarantine-$ACCOUNT; do aws s3api list-object-versions --bucket "$B" --query '[Versions,DeleteMarkers][].[Key,VersionId]' --output text; done
for B in knest-s1-documents-$ACCOUNT knest-s1-quarantine-$ACCOUNT; do aws s3api list-object-versions --bucket "$B" --query '[Versions,DeleteMarkers][].[Key,VersionId]' --output text | while read -r KEY VID; do [ -n "$VID" ] && aws s3api delete-object --bucket "$B" --key "$KEY" --version-id "$VID" > /dev/null; done; done
```

The media bucket (`knest-s1-bucket-...`) is not versioned; empty it with `aws s3 rm s3://<bucket from the stack> --recursive`. The template bucket is not in any stack: remove its versions the same way (`--bucket knest-s1-templates-166917387892`), then `aws s3api delete-bucket --bucket knest-s1-templates-166917387892`. Manual RDS snapshots `pre-migrate-*` are handled in the leftovers table below.

### 12.2 Stack deletion

**Normal path:** the schedules installed in B0 delete `knest-s1-edge` at 00:00 UTC, `knest-s1-waf` at 02:00 UTC after CloudFront has released the ACL, then `knest-s1-ci` and `knest-s1` at 04:00 UTC. At 00:15, 02:15 and 04:15 UTC, inspect the relevant stack events; continue monitoring hourly until every stack is absent. A schedule invocation is not proof that CloudFormation deletion succeeded. Check afterwards that the stacks are gone (12.3). **Manual path** (cost stop, failure, or the schedules not trusted), in this order, each with the service role:

```bash
aws cloudformation delete-stack --stack-name knest-s1-edge --role-arn "$CFN_ROLE"
aws cloudformation wait stack-delete-complete --stack-name knest-s1-edge
aws cloudformation delete-stack --region us-east-1 --stack-name knest-s1-waf --role-arn "$CFN_ROLE"
aws cloudformation wait stack-delete-complete --region us-east-1 --stack-name knest-s1-waf
aws cloudformation delete-stack --stack-name knest-s1-ci --role-arn "$CFN_ROLE"
aws cloudformation delete-stack --stack-name knest-s1 --role-arn "$CFN_ROLE"
```

A stack left in `REVIEW_IN_PROGRESS` (change set never executed) or `ROLLBACK_COMPLETE` is deleted the same way before it can be created again.

### 12.3 Stack inventory and refusal gate, then the utility cleanup

The utility `cleanup` removes only scheduler resources (the four schedules, the two groups, `knest-s1-scheduler` and its inline policy) and never touches `knest-s1-cfn-service`. It refuses while any of the four stacks exists, in any status. Confirm that yourself first; each command must report that the stack does not exist:

```bash
aws cloudformation describe-stacks --region ap-south-1 --stack-name knest-s1-edge --query 'Stacks[0].StackStatus' --output text
aws cloudformation describe-stacks --region us-east-1 --stack-name knest-s1-waf --query 'Stacks[0].StackStatus' --output text
aws cloudformation describe-stacks --region ap-south-1 --stack-name knest-s1-ci --query 'Stacks[0].StackStatus' --output text
aws cloudformation describe-stacks --region ap-south-1 --stack-name knest-s1 --query 'Stacks[0].StackStatus' --output text
```

Only when all four say `does not exist` (owner/root session, the same profile as `install`):

```bash
node scripts/s1-teardown.mjs cleanup --profile claude-deploy --allow-root-bootstrap
```

A fired schedule has already deleted itself (`ActionAfterCompletion` `DELETE`), so the utility reports it as already gone. If it refuses, a stack is still present or in `DELETE_FAILED`: fix the cause (usually a non-empty bucket, 12.1) and repeat; do not delete the scheduler role by hand.

**Leftovers a stack delete does not remove:**

| Item | Command or owner action |
|---|---|
| Manual RDS snapshots `pre-migrate-*` made by every deploy | `aws rds describe-db-snapshots --snapshot-type manual --query 'DBSnapshots[?starts_with(DBSnapshotIdentifier, `pre-migrate-`)].DBSnapshotIdentifier' --output text`, then `aws rds delete-db-snapshot --db-snapshot-identifier <id>` for each that belongs to S-1 |
| Secrets `knest-s1/origin-verify`, `db-runtime`, `auth-secret`, `payload-secret`, `turnstile-secret` (a stack delete leaves a recovery window) | Owner or an administrator: `aws secretsmanager delete-secret --secret-id <name> --force-delete-without-recovery`. The operator policy cannot delete them |
| KMS key (the stack schedules deletion after 7 days) | `aws kms list-aliases` shows no `alias/knest-s1-documents`; the key is `PendingDeletion` |
| ECR images (`EmptyOnDelete` is on for S-1) | `aws ecr describe-repositories` shows no `knest-s1-app` |
| GitHub OIDC provider | Deleted only if `knest-s1-ci` created it; a reused provider stays |
| GitHub Environment `s1` variables | A person with repository admin removes the Environment or its four variables (the role ARNs are dead after teardown) |
| Schedules, both schedule groups, `knest-s1-scheduler` | `node scripts/s1-teardown.mjs cleanup --profile claude-deploy --allow-root-bootstrap` (12.3), after the stack gate |
| `knest-s1-cfn-service`, budget `knest-s1` | Last, by hand (the utility never touches the service role), after the inventory below |

Final read-only inventory, run with the explicitly authorised `claude-deploy` root profile because several account-wide list actions are intentionally absent from the scoped operator policy (each must find nothing named `knest-s1`): `aws ec2 describe-instances`, `describe-volumes`, `describe-snapshots --owner-ids self`, `describe-network-interfaces`, `describe-addresses`, `describe-security-groups`, `describe-vpcs`; `aws rds describe-db-instances`, `describe-db-snapshots`; `aws logs describe-log-groups --log-group-name-prefix /knest-s1`; `aws s3api list-buckets`; `aws sqs list-queues --queue-name-prefix knest-s1`; `aws events list-rules --name-prefix knest-s1`; `aws cloudwatch describe-alarms --alarm-name-prefix knest-s1`; `aws guardduty list-malware-protection-plans`; `aws ssm describe-parameters`; `aws iam list-roles` (names starting `knest-s1`); `aws cloudfront list-distributions`; `aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1`. Put the final Cost Explorer figure in `EVIDENCE/S-1.md`. The pre-existing media bucket and its IAM user (S-1-PREFLIGHT section 5) must be unchanged.
