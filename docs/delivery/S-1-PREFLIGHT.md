# S-1 preflight (conditions set by the owner on 2026-10-09)

**Status: NOT STARTED on AWS. Nothing has been provisioned.** The approval in `DECISIONS-2026-10-09.md` is conditional on the checks below. This file states each condition, what is known, what is a design decision, and what is still blocking. It builds on `S-1-SPEC.md` (tests and pass criteria) and `S-1-APPROVAL-PACKET.md` (resource table).

## 1. Gate summary

| # | Condition | State |
|---|---|---|
| G1 | A scoped identity exists and replaces root (A4) | **BLOCKED on the owner**: steps in section 2 |
| G2 | Account ID, owner, billing owner and authenticated identity shown (A1) | Blocked on G1 (first command after G1) |
| G3 | A6 budget e-mail provided and verified | **NOT PROVIDED** |
| G4 | EC2 reaches SSM and pulls the image with no inbound SSH | Design in section 3; proven only at provisioning |
| G5 | RDS has no public endpoint; components isolated | Design in section 3; proven by `describe-db-instances` after provisioning |
| G6 | Every charge is inside the USD 25 ceiling | Section 4 (est. about USD 6 for a 5-day run, about USD 15 for the full 14 days, gross, before credits) |
| G7 | Expiry is an automated teardown, not just tags | Design in section 5; **needs your approval of two extra roles (decision S1-1 below)** |
| G8 | Image: private package, no secrets, deployed by digest | Section 7; **needs a read-only pull token created by you (decision S1-2)** |
| G9 | Template and teardown reviewed before use | To write; reviewed with you before anything is created |

## 2. The scoped identity (owner action, about 10 minutes)

The only AWS session this project had was the root session; it has expired and will not be used again. No access keys are created: the operator signs in with the AWS CLI's browser login and gets short-lived credentials. Do this in the AWS console, signed in as the account owner:

1. **IAM > Policies > Create policy > JSON.** Paste the contents of `infra/s1/operator-policy.json` from the repository. Name it `KnestS1Operator`. Read it first; it allows only the Mumbai region, creates no users or access keys, and limits IAM write actions to roles and instance profiles named `knest-s1-*`.
2. **IAM > Users > Create user** named `knest-operator`. Tick "Provide user access to the AWS Management Console" and choose "I want to create an IAM user". Set a password you keep to yourself and require a change at first sign-in.
3. On the permissions step choose "Attach policies directly" and attach **`KnestS1Operator`** and the AWS managed policy **`SignInLocalDevelopmentAccess`** (it lets this user use `aws login`). Do not attach AdministratorAccess.
4. Open the user > Security credentials > **Assign MFA device** and complete it. Do not create access keys.
5. On this machine, type in the Claude Code prompt: `! aws login --profile knest-s1` and sign in as `knest-operator` in the browser. Then tell me to continue.
6. Optional hygiene: `! aws logout --profile claude-deploy` to remove the expired root profile.

First thing I then run, read-only: `sts get-caller-identity`, account alias, contact and billing information, then the B1 investigation of `knest-app`. If anything in the policy needs changing I will say what and why.

## 3. Isolation and reachability (G4, G5)

- One VPC (10.20.0.0/16). EC2 in a public subnet with a public IPv4 address **for outbound traffic only**; its security group has **no inbound rules**. Management is by SSM Session Manager (outbound HTTPS to the SSM endpoints through the internet gateway), so no SSH and no port 22.
- SSM and the image pull both need outbound internet. With a public IPv4 address and an internet gateway **no NAT gateway and no VPC interface endpoints are needed**. If a later requirement removes the public address, the alternative (three SSM interface endpoints, about USD 22 per month per AZ, plus a NAT or ECR endpoints) is outside this budget and would be a new decision.
- RDS: two private subnets in two AZs (a DB subnet group needs two), `PubliclyAccessible=false`, security group allowing 5432 only from the EC2 security group, `rds.force_ssl=1`, encrypted storage.
- S3 test bucket: all public access blocked, SSE-S3, bucket policy limiting access to the instance role.
- Proof, not assertion: after provisioning I run `describe-db-instances` (PubliclyAccessible, Endpoint), `describe-security-groups` (no inbound on EC2; 5432 only from EC2 SG on RDS), an attempted connection to the RDS endpoint from outside the VPC (must fail), and an SSM `echo` through the instance. Results go to `EVIDENCE/S-1.md`.

## 4. Cost (G6): what is counted

| Item | Basis | 5-day run | 14-day backstop |
|---|---|---|---|
| EC2 `t4g.small` | 0.0112 USD per hour (AWS price list, Mumbai) | about 1.3 | about 3.8 |
| Public IPv4 (EC2) | 0.005 USD per hour per address | about 0.6 | about 1.7 |
| EBS 20 GB gp3 | about 0.09 USD per GB-month | about 0.3 | about 0.9 |
| RDS `db.t4g.micro` Single-AZ | 0.021 USD per hour (AWS price list, Mumbai) | about 2.5 | about 7.1 |
| RDS 20 GB gp3 storage (1-day backups, within the free backup allowance) | 0.131 USD per GB-month (AWS price list) | about 0.4 | about 1.2 |
| CloudFront test distribution and ECR (a few hundred MB) | free tier / 0.10 per GB-month | about 0 | about 0.1 |
| Secrets Manager (RDS-managed master password) | 0.40 per secret per month, prorated | about 0.1 | about 0.2 |
| Optional `t4g.medium` for 8 hours | only if 2 GiB fails | up to 0.3 | up to 0.3 |
| CloudWatch Logs (7-day retention) | ingestion + storage | about 0.3 | about 0.5 |
| Data transfer | small; first 100 GB out per month free; image pull is inbound | about 0 | about 0 |
| SSM, Parameter Store (standard), Budgets (first two), Scheduler (low volume), S3 test bucket | | about 0 | about 0 |
| NAT gateway, interface VPC endpoints, ELB, Elastic IP not attached | **not used** | 0 | 0 |
| **Total (gross, before credits)** | | **about 6** | **about 15** |

The EC2 and RDS lines are from AWS's public price list for Mumbai (read 2026-10-09; an earlier version of this table used guessed prices, which these figures replace). The other lines are published rates to re-check in the AWS Pricing Calculator. Replace all with Cost Explorer actuals at the end. The ceiling applies to gross spend, not to credits. **Cost-watch procedure:** at each stage I read Cost Explorer (daily, with the hour lag it has), record the figure in `EVIDENCE/S-1.md`, and stop and tear down if the running total plus the remaining plan could reach USD 20. Budget alerts at 50/80/100% (USD 12.50 / 20 / 25) are added once G3 is satisfied, with an extra alert on forecast. A budget does not stop spend by itself; my teardown does.

## 5. Automated teardown (G7)

Tags alone delete nothing. Design:

- Everything is one CloudFormation stack, `knest-s1`, created from a reviewed template in the repository (`infra/s1/`, to be written and reviewed with you first). Deleting the stack removes the instance, volumes, RDS (no final snapshot, deletion protection off), security groups, subnets, gateway, route tables, the log group (it is in the stack), the instance role/profile and the test bucket (the stack empties it through a deletion-time custom action only if you approve; otherwise I empty it by command before deleting).
- **The expiry mechanism:** a one-time EventBridge Scheduler schedule `knest-s1-expire` at creation time + 14 days calls `cloudformation:DeleteStack` on `knest-s1` through a scheduler role.
- **Decision S1-1 (extends A4):** this needs two more IAM roles, both named `knest-s1-*` and deleted at teardown: a scheduler role (may only call `DeleteStack` on this stack) and a CloudFormation service role (permissions to delete what the stack made). Without them the only teardown is me running the command. Please approve or refuse.
- The scheduler and its role are outside the stack so they can delete it; they are removed last by hand and checked by the inventory.
- Cleanup list I verify at the end with a read-only inventory: EC2 instances, EBS volumes and snapshots, RDS instances, snapshots (manual and automated) and parameter groups, Elastic IPs and public addresses, security groups, ENIs, VPC and subnets, gateway, log groups, S3 test bucket and versions, SSM parameters, IAM roles/profiles named `knest-s1-*`, schedules, the budget. The pre-existing bucket `knest-media-*`, user `knest-app` and its policy must remain unchanged.

## 6. The `knest-app` key (B1) and the migration to role credentials

1. After G1: read-only checks of the user, its attached and inline policies, the access key's creation date and last-used service/region/time (no secret value is retrievable or printed), CloudTrail events for the user in the last 90 days if available, and the creator of the user and bucket.
2. Repository facts are in `DECISIONS-2026-10-09.md`.
3. Target: on AWS the application uses the instance role (no stored key). The code path is already compatible (`undefined` credentials fall back to the SDK chain); the one change needed is to switch S3 on by `S3_BUCKET` alone (B2 integration).
4. Until the new path is proven in S-1, the key stays exactly as it is.

## 7. Image delivery (G8)

- GitHub Actions builds the arm64 image (QEMU or an arm64 runner), runs a secrets scan on the build context and the image layers, and publishes to GHCR. **The package stays private.** The host deploys by `@sha256:` digest recorded in the release note; a tag is never deployed.
- **Trade-off, as you asked me to document it before changing visibility:** the host must authenticate to pull a private GHCR image. That takes a fine-grained GitHub token with only `read:packages`, stored as an SSM SecureString (never in chat, never in the template, never in logs), and revoked at teardown. Cost: USD 0. The alternative is a private ECR repository, which needs no token on the host (the instance role pulls) but needs CI to push with AWS credentials, which means an OIDC provider and one more role; this is more setup and more IAM for a 14-day sandbox. **Recommendation: private GHCR plus a short-lived read-only token.**
- **Decision S1-2:** you create that token (GitHub > Settings > Developer settings > Fine-grained or classic with `read:packages`, expiry at most 14 days) and store it in the SSM parameter `/knest-s1/ghcr-pull-token` yourself in the console once the stack exists. I never see it. If you prefer ECR, say so and I will design that instead.
- The repository is currently public. A private package in a public repository is allowed. The build log and image will be checked for secrets before first publication.

## 8. Owner decisions that remain for S-1

| # | Decision | Recommendation |
|---|---|---|
| G1 | Create the scoped identity (section 2) | Do it; it also unblocks the account and key investigation |
| G3 / A6 | The budget alert e-mail address | Provide; used only for AWS Budgets notices |
| S1-1 | Two extra `knest-s1-*` roles for automated teardown (scheduler role, CloudFormation service role) | Approve |
| S1-2 | Private GHCR plus a read-only pull token you create and store in SSM | Approve |

Once G1, G3, S1-1 and S1-2 are settled and the template is reviewed, provisioning is allowed within the USD 25 ceiling. Until then the repository work continues.

## 9. Updates after the owner's decisions of 2026-10-09 (AWS-native, one production environment)

- **S1-2 is superseded.** The image goes to a **private ECR** repository through a GitHub **OIDC** role with short-lived credentials. There is no pull token, no GHCR package and no long-lived GitHub key. The host pulls from ECR with its instance role, by digest.
- **S-1 scope grows slightly, inside the same USD 25 ceiling and the same teardown:** (a) an ECR push from GitHub Actions through the OIDC role and a pull on the host by digest; (b) a CloudFront test distribution on its default `*.cloudfront.net` hostname (no DNS involved) to compare a public EC2 origin restricted to CloudFront against a CloudFront VPC origin with a private instance, including origin-bypass attempts, SSM/ECR/SES/Turnstile/Google connectivity, and NAT or endpoint cost; (c) a WAF web ACL attached to it with the planned rules.
- **There is no S-2 and no staging.** Production verification is private-first on the production stack (`AWS-NATIVE-ARCHITECTURE.md` section 4).
- **S1-1 now has exact policies** to review: `infra/s1/teardown-roles.json` holds the trust and permission documents for the two `knest-s1-*` teardown roles, with notes on what each can and cannot do.
- **The operator policy** (`infra/s1/operator-policy.json`, still one policy, 5.2k of the 6.1k character limit) was widened for the above: us-east-1 is allowed only for CloudFront-scope WAF (compute and databases are still denied outside Mumbai), and CloudFront, WAF, ECR and the GitHub OIDC provider were added, limited to `knest-s1*` names where AWS supports it (CloudFront has weak resource scoping, so the operator has account-wide CloudFront rights for the sandbox). The operator can never read secret values or the `knest-s1` parameters.
