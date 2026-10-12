# E6.06 `ci.yaml`: registry, GitHub OIDC and the two pipeline roles

Source: `infra/cfn/ci.yaml` (179 lines). Deployed in ap-south-1 as `knest-production-ci`. The only hosted evidence is that the release workflow assumed both roles and pushed and deployed images (`V1-DEPLOYMENT-REPORT.md:18`, `:36`).

## 1. Parameters (`ci.yaml:13-45`)

| Parameter | Default | Constraint | Why |
|---|---|---|---|
| `Environment` | none | s1/production | Role names and tag condition. |
| `GitHubRepository` | `KNEST-KIIT/knest` | `owner/name` pattern | Builds the subject `repo:<owner/name>`. |
| `CreateOidcProvider` | `'true'` | true/false | One GitHub provider may exist per account; use false if present. |
| `ExistingOidcProviderArn` | `''` | empty or provider ARN | Required when not creating (rule at `:47-52`). |
| `RepositoryName` | `knest-app` | none | Must match `app.yaml` `EcrRepositoryName`. |
| `GitHubSubjectPrefix` | `''` | `repo:` prefix pattern | For GitHub's immutable subject form, `repo:ORG@<org-id>/name@<repo-id>`. |
| `GitHubEnvironmentName` | `''` | letters, digits, `_-` | For when the GitHub environment's spelling differs in case (for example `Production`). |

Why the last two exist: the first hosted attempt failed to assume the role because GitHub issued an immutable-form subject and a differently capitalised environment name; fixed in commit `7c3429e` (`V1-DEPLOYMENT-REPORT.md:34`).

## 2. Resources

### `Repository` (`ci.yaml:61-73`)

| Property | Value | Reason |
|---|---|---|
| `ImageTagMutability` | `IMMUTABLE` | A pushed tag cannot be repointed; deployment uses digests anyway. A re-run of the workflow for the same SHA fails at push, because `app-<sha>` already exists (see file 09). |
| `ImageScanningConfiguration.ScanOnPush` | true | Feeds the scan gate. |
| Encryption | AES256 | |
| `EmptyOnDelete` | false in production | A non-empty repository blocks stack deletion in production. |
| `DeletionPolicy`/`UpdateReplacePolicy` | `Retain` (S-1: `Delete`) | |
| Lifecycle | expire when more than 20 images exist, `tagStatus: any` | Two images per release (app and migrate), so about 10 releases remain. A digest older than that cannot be redeployed (`RUNBOOK.md:38`, `:200`). |

### `OidcProvider` (`:75-80`)

`https://token.actions.githubusercontent.com`, client id `sts.amazonaws.com`, created only when `MakeProvider`. No thumbprint is set; AWS validates GitHub's chain itself (AWS service behaviour, not shown in the template).

### `PushRole` `knest-${Environment}-ci-push` (`:82-123`) and `DeployRole` `knest-${Environment}-ci-deploy` (`:125-169`)

Trust policy (identical in both): `sts:AssumeRoleWithWebIdentity` from the provider, `StringEquals` on `aud = sts.amazonaws.com` and `sub` in a two-element list (OR semantics): `<prefix>:environment:<Environment>` and `<prefix>:environment:<GitHubEnvironmentName or Environment>`. `MaxSessionDuration` 3600.

Consequences:

- A job can assume a role only when GitHub has attached it to the matching GitHub **Environment**. A job without `environment:` presents a different `sub` and is refused. For production the Environment is to carry required reviewers, so every deploy and every push to production ECR needs human approval (`release-image.yml:4-9`). Whether the reviewers rule is actually enabled cannot be seen from the repository (`RUNBOOK.md:64`, left as PLACEHOLDER).
- There is **no** `job_workflow_ref` or branch condition. Any workflow file in the repository that declares `environment: production` can assume both roles. Protection rests on the Environment's reviewer and branch rules, configured outside the repository. Not determined from the code whether a deployment-branch restriction is set.
- The two roles have the same trust, so a job holding one can assume the other. Separation is by permission, not by who may assume.

Permissions:

| Role | Statement | Actions | Resource |
|---|---|---|---|
| Push | `Login` | `ecr:GetAuthorizationToken` | `*` (required) |
| Push | `PushToThisRepositoryOnly` | `BatchCheckLayerAvailability`, `BatchGetImage`, `CompleteLayerUpload`, `DescribeImages`, `DescribeImageScanFindings`, `GetDownloadUrlForLayer`, `InitiateLayerUpload`, `PutImage`, `UploadLayerPart` | the repository ARN |
| Deploy | `RunOnlyThisEnvironmentsDeployDocument` | `ssm:SendCommand` | document `knest-<env>-deploy` |
| Deploy | `OnlyOnThisEnvironmentsHost` | `ssm:SendCommand` | `instance/*` with condition `ssm:resourceTag/knest-deploy-target == <env>` |
| Deploy | `ReadResults` | `ssm:GetCommandInvocation`, `ListCommandInvocations` | `*` |
| Deploy | `ResolveDigests` | `ecr:DescribeImages` | the repository ARN |

Why it is shaped this way: `DescribeImageScanFindings` is on the push role because the scan gate runs in the same job as the push (`release-image.yml:131-164`). The push role has no `ssm:`, `iam:`, `s3:` or `ec2:`, and the deploy role has no `ecr:Put*`/`Upload*` (`templates.test.ts:231-234` asserts both by regular expression). `ssm:SendCommand` needs two statements because SSM authorises the document and the target instance separately. `GetCommandInvocation` does not support resource scoping, so it is `*`.

Weaknesses:

- The `Environment` document parameter is unvalidated (`app.yaml:510-512`), so the deploy role is not confined to "deploy an image by digest": it can run arbitrary shell as root on the host (D-03).
- `ssm:SendCommand` accepts `--targets Key=tag:...`; the tag condition applies per resolved instance. A stray instance with the same tag in the account would also receive the deploy. Nothing in the account currently suggests another.
- The push role can push any content to the repository; the scan gate (CRITICAL and HIGH only) and the exact-SHA CI gate are the only content controls. There is no image signing (`DELIVERY-AUDIT-2026-10-12.md:83`).

## 3. Outputs (`ci.yaml:171-179`)

`RepositoryUri`, `PushRoleArn`, `DeployRoleArn`: copied by hand into GitHub Environment variables `AWS_PUSH_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN`, with `AWS_REGION` and `ECR_REPOSITORY` (`release-image.yml:11-16`). A missing variable is caught by the first job step, which names it (`release-image.yml:76-84`).

## 4. Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| "Not authorized to perform sts:AssumeRoleWithWebIdentity" | Environment name or subject form differs; job lacks `environment:` | `GitHubEnvironmentName`, `GitHubSubjectPrefix` (commit `7c3429e`) |
| Second OIDC provider creation fails | account already has the GitHub provider | `CreateOidcProvider=false` plus the ARN |
| Push fails with "tag invalid: immutable" | `app-<sha>` already exists | re-running for the same SHA is not possible; use the existing digest or add a commit |
| Deploy cannot find the document | stack for another environment, name mismatch | document name is derived `knest-<env>-deploy` |
| Operator update of this stack fails | change set needs IAM capability | pass `CAPABILITY_NAMED_IAM`; operator policy lets the operator act only through the service role (`infra/iam/operator-policy.json:32-41`) |
