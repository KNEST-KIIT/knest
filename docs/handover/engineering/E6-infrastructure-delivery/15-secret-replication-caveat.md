# E6.15 The cross-region secret replication caveat

## 1. The problem

`app.yaml` creates the secret `knest-<env>/origin-verify` in ap-south-1 with a generated 48-character value (`app.yaml:307-315`). The CloudFront distribution must carry that value as the `X-Origin-Verify` request header (`edge.yaml:223-225`) and gets it with a CloudFormation dynamic reference:

```
HeaderValue: !Sub '{{resolve:secretsmanager:${OriginVerifySecretId}:SecretString}}'
```

CloudFormation resolves a dynamic reference **in the region of the stack that contains it**. The edge stack is deployed in us-east-1 (because the WAF web ACL and the ACM certificate it references live there, and the operators run the whole edge group in one region: `cutover-apply.sh:42,47,55,62`). The secret does not exist there unless it is replicated, so the first edge deployment would fail with an unresolved reference. The deployment report records the finding and the manual fix: "Secret replica of `origin-verify` to us-east-1" (`V1-DEPLOYMENT-REPORT.md:39`, `:42`), and asks that the runbook document it. Neither `RUNBOOK.md` nor either template does.

## 2. Why it is a caveat and not just a step

| Aspect | Consequence |
|---|---|
| The replica is created by hand (console or CLI), not by CloudFormation. `app.yaml` has no `ReplicaRegions` on the secret. | The replica is not in any template, so it is not reproduced by redeploying the stack, not covered by the template tests, and is not mentioned in the template's own description (`app.yaml:310` says "edge.yaml reads it by dynamic reference" and nothing about regions). Which exact CLI command was used is not recorded. |
| Name must be identical | `OriginVerifySecretId` is a name (`knest-production/origin-verify`), allowed pattern `^[A-Za-z0-9/_+=.@-]{1,512}$` (`edge.yaml:40`). Replicas keep the primary's name, so the same parameter value works; a differently named copy would not. |
| Value is copied at deploy time into the distribution | The header value is stored in the distribution configuration when the edge stack is created or updated. The distribution does not read Secrets Manager at request time. A later change of the secret's value does not reach CloudFront until the edge stack is updated. Hence the symptom "every page answers 403" after a rotation (`RUNBOOK.md:284`): the app has the new value after the next deploy, CloudFront still sends the old one, or the reverse. |
| The application reads the primary | The deploy document reads `knest-<env>/origin-verify` in the instance's own region (`app.yaml:576`), i.e. the primary. Both sides are therefore correct only at the moment they were last deployed with the same value. |
| `GenerateSecretString` runs at resource creation | If the `OriginVerifySecret` resource is ever replaced (a name change, or the stack being recreated), a new value is generated, the replica no longer matches the primary's lineage, and the app and the edge diverge until both are redeployed. Replication also requires the primary to exist; behaviour when a CloudFormation-managed primary with a manual replica is deleted or replaced is not determined from the code and should be tested before relying on it. |
| IAM | The identity that executes the edge stack change (the CloudFormation service role, `knest-production-cfn-deploy`; created per `IAM-OPERATOR-AND-SETTINGS.md:14-30`, not part of any template) must be allowed `secretsmanager:GetSecretValue` on the replica in us-east-1. The operator policy explicitly denies reading secret values (`operator-policy.json:160`), which is correct: the service role reads it, not the operator. The service role's actual permissions are recorded only as "start from AdministratorAccess, then narrow" (`IAM-OPERATOR-AND-SETTINGS.md:16`). |
| Cost | The replica is a separate billed secret (about USD 0.40 per month; `ROLLOUT-PLAN-AND-BILLING.md:64` lists "~5 secrets + 1 replica"). |
| Exposure | The value is visible, in clear, in the distribution configuration to anyone with `cloudfront:GetDistributionConfig` (the operator policy allows `cloudfront:Get*`, `:70`). Dynamic references hide the value in CloudFormation, not in the resource it configures. The secret's protection is "something only our distribution adds", not confidentiality against account readers. |

## 3. Safe procedure for a rotation (derived; not rehearsed)

1. Update the value in the primary (ap-south-1); confirm the replica shows the new value in us-east-1 (replica sync is automatic for value updates; verify rather than assume).
2. Update the edge stack (a no-op parameter change forces dynamic reference re-resolution is **not** guaranteed; a change set that modifies the distribution, for example a harmless `Comment`, is). Verify in the change set that `Distribution` is modified.
3. Redeploy the container so `ORIGIN_VERIFY_SECRET` is rebuilt.
4. Between steps 2 and 3 requests are refused (403); there is no overlap window because the app accepts exactly one value (`edge-guard.ts:68-71`). Perform when an outage window is acceptable, or accept the app-first order below.

Ordering note: if the app deploys first, CloudFront still sends the old value and everything is refused; if the edge updates first, the app still expects the old value and everything is refused. The window exists either way; it ends when the second step completes. `/api/health` is exempt, so the host and ALB stay healthy during it (`edge-guard.ts:29-30`).

## 4. Options that remove the caveat (not implemented)

- Declare `ReplicaRegions: [{Region: us-east-1}]` on `OriginVerifySecret` in `app.yaml`, so the replica is under CloudFormation.
- Create the origin-verify secret in the us-east-1 stack and replicate the other way; the application would read the replica.
- Accept two values in `edge-guard.ts` during rotation windows.

These are suggestions for the maintainers, not repository content. None changes the fact that the distribution holds a copy.

## 5. Verification that exists

- Application guard behaviour: `src/server/security/edge-guard.test.ts:8-31` (missing, wrong, right secret; health exempt).
- Template: `templates.test.ts:185-190` asserts the dynamic reference and header name are present. It does not check the region.
- Hosted: the preview was reported reachable with the gate, with the ALB unreachable directly (`V1-DEPLOYMENT-REPORT.md:21-25`), which implies the replicated secret resolved at edge creation. The hosted rotation path has never been exercised.
