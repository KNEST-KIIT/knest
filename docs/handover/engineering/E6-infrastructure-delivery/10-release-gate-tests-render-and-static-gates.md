# E6.10 Release-gate tests, template tests, the S-1 render, and static gates

## 1. What the infrastructure tests are, and are not

`infra/cfn/templates.test.ts` (269 lines) and `infra/cfn/release-gates.test.ts` (27 lines) run in the ordinary unit run (`vitest.config.mts:7` includes `infra/**/*.test.ts`). Their own header says it: "A passing run is not proof that CloudFormation will accept a template; the first real deployment (S-1) is" (`templates.test.ts:6-12`). They are text and structure checks over YAML parsed with the `yaml` package and custom tags for `!Ref`, `!Sub` and the other short-form functions (`:16-21`).

### Generic checks, run for each of the eight templates (`templates.test.ts:67-80`)

| Test | What it does | Blind spots |
|---|---|---|
| parses, every resource has a `Type` matching `AWS::X::Y` | structure | does not know whether the type or property exists |
| no dangling reference | walks `Ref`, `GetAtt`, `Sub` placeholders and `If` condition names against known parameters and resources (`:37-65`) | `Fn::ImportValue`, `Fn::FindInMap`, `Fn::Cidr` arguments, `Condition` keys inside `Fn::And` are not walked; the property names are not validated |
| no secret in text | regex for `AKIA...`, `BEGIN ... PRIVATE KEY`, quoted `password:` literals | a base64 or short token passes |

### Property assertions

| Template | Asserted (lines) | Not asserted |
|---|---|---|
| `app.yaml` | DB private, encrypted, managed password, retention at least 7, SG ingress has no `CidrIp`, subnet group excludes public subnets (`:86-98`); production ingress is conditional with `AWS::NoValue` and no port 22 (`:100-106`); IMDSv2, encrypted root volume, no static keys (`:108-114`); bucket public-access block and TLS-only policy (`:116-120`); SES from-address condition, no `iam:`, no `Action: "*"`, no `s3:*` (`:122-130`); AMI/digest pattern `@sha256:[a-f0-9]{64}$` present (`:132-134`); S-1 vs production deletion policies and that nothing else differs (`:136-146`) | deploy document logic (shell) is not executed or linted; `Environment` allowedPattern absence is not detected; secret-read scoping is only a regex on JSON |
| `origin.yaml` | HTTPS listener on 443 with a certificate and two subnets; ingress only from a prefix list; `/api/health` check (`:149-165`) | cipher policy, port equality with `app.yaml` |
| `edge.yaml` | CachingDisabled policy id; only `/_next/static/*` extra behaviour with none-cookie/header/query key; HTTPS redirect, origin-verify header from a secret reference, WAF attached; inline function equals `infra/edge/viewer-request.js` apart from the hash (`:167-198`) | the production rule `ProductionOriginUsesTls` is not evaluated (CloudFormation Rules are not simulated) |
| `waf.yaml` | exactly five rules; no Bot Control, CAPTCHA, Challenge, ATP or ACFP; `CLOUDFRONT` scope; `SizeRestrictions_BODY` override present (`:200-212`) | rule action semantics |
| `ci.yaml` | both trust policies use web identity, `token.actions.githubusercontent.com:sub` with `environment:`, `sts.amazonaws.com`, no `"*"`; immutable tags and scan on push; push role has no `ssm:/iam:/s3:/ec2:`, deploy role has no `ecr:Put/Upload`, `iam:`, `s3:`, `ec2:Run` (`:214-235`) | the exact subject string is not compared to GitHub's real claim format |
| `dns.yaml` | Google mail records equal expected values; the DKIM key joined from its two strings equals the saved snapshot and each string is at most 255 characters; web records are conditional on `HasCloudFront` and the parameter defaults to empty; no A/AAAA at a mail record name (`:237-269`) | records absent from the snapshot; the `.in` zone; the origin record (D-08) |
| `cert.yaml`, `ses.yaml` | generic checks only | |

Reading across: where a bug in the templates has been found it was by a real deployment (the `DeployDocument` replacement rollback, `OPERATOR-COMMANDS.md:55`; OIDC subject form, `V1-DEPLOYMENT-REPORT.md:34`; ECR scan waiter timing, `:36`), not by these tests. `cfn-lint` is reported clean at commit `fac5d49` (`RUNBOOK.md:9`) but is not wired into CI.

## 2. `release-gates.test.ts`

Parses `.github/workflows/release-image.yml` and asserts:

1. `build-and-push.needs === 'verify-source'`, the gate job has `permissions.actions === 'read'`, and its first step's script contains `head_sha=${GITHUB_SHA}`, `.head_sha == $sha`, `.conclusion == "success"` (`:8-16`).
2. In the `refs` step, the env passes both digests from step outputs, the script contains `aws ecr wait image-scan-complete`, `describe-image-scan-findings`, `(.HIGH // 0)`, and `(.CRITICAL // 0)` occurs before `echo "app_image=` (`:18-26`).

This is a regression fence against someone deleting or reordering the gates. It is **not** a behavioural test of the jq expression or of the `gh api` query. A change that keeps the strings but breaks the logic (for example `== 0` to `>= 0`) passes. See D-11.

## 3. `scripts/render-cfn.mjs` and the S-1 variant

`render(text, variant)` (`scripts/render-cfn.mjs:15-19`): production returns the text unchanged; `s1` replaces the policy value on lines matching `^\s*(DeletionPolicy|UpdateReplacePolicy): (Snapshot|Retain|Delete) # DELETION$` with `Delete`. Any other variant throws. `main` accepts only `app` or `ci` as template name (`:21-29`).

Why: one source file means the disposable spike tests the same template production runs. The test at `templates.test.ts:136-146` proves the S-1 rendering differs from the source only in those policy values.

Where it bites: the `# DELETION` marker is a plain-text convention. A new stateful resource added without it will be retained or snapshotted even in S-1 (teardown leaves it); a marker on the wrong resource would silently delete production data if rendered with `s1` by mistake. Production deployment uses the file unrendered (`RUNBOOK.md:51`). Resources carrying markers: `Database` (`app.yaml:248-249`), `Bucket` (`:276-277`), ECR `Repository` (`ci.yaml:63-64`). `EmptyOnDelete` and `DeletionProtection` vary by the `IsProduction` condition, not by render.

## 4. Static gates run in CI

### `scripts/scan-secrets.mjs` (75 lines)

Scans `git ls-files` (or given files), skipping `pnpm-lock.yaml`, `node_modules`, `.next`, `.git`, images, fonts, archives. Seven patterns (`:15-23`): AWS access key ids (`AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA|AIPA` + 16), `aws_secret_access_key` assignment, private key block, GitHub tokens, Slack tokens, Cloudflare Turnstile secret (`0x4...`, 30+), Google API key. Allowlist: strings containing `EXAMPLE`, starting `AKIAIOSFODNN7`, or runs of `x`. It never prints the matched value (`:65`). Exit 1 on any finding. Tests: `infra/security/scan-secrets.test.ts`.

Limits: it does not find generic passwords, database URLs with credentials, or the Cloudflare Turnstile **test** keys (not secrets). It scans the current tree, not history. Passwords such as the preview gate password live in an untracked local file by design (`V1-DEPLOYMENT-REPORT.md:83`). It runs twice: in CI `static` and in the release job.

### `scripts/check_bundle_budget.mjs`

Gzips (level 9) every file in `.next/static/chunks` and `.next/static/css` and compares to `scripts/bundle-budget.json`: JS 1,350,000 bytes, CSS 120,000, largest JS chunk 420,000 (measured 1,162,749 / 103,478 / 365,155 on 2026-10-12, about 15 percent headroom). Pure function of the build output; exits 2 if there is no build. `--print` shows numbers. It is not Lighthouse. It would not catch a slow server response or an unbounded third-party script loaded at run time.

### `scripts/lint_hardcodes.py src`

Design-token lint: fails on literal colours, lengths and durations in `src` that are not allowed exceptions. Present in CI `static` (`ci.yml:53-54`). Rules are in `docs/delivery/TOKEN-PIPELINE.md`.

### `pnpm audit --prod --audit-level=moderate`

Two accepted GHSA ids are listed in `pnpm-workspace.yaml` (braces, esbuild dev-server). The audit config applies to production dependencies only. GitHub's own dependency alerts (1 critical, 6 high, 13 medium, 3 low as of 2026-10-12) are separate and "nobody has triaged them" (`DELIVERY-AUDIT-2026-10-12.md:66`); a later document, `docs/delivery/DEPENDENCY-TRIAGE.md`, exists and was not part of this volume's reading.
