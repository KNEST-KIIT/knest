# E6.09 GitHub Actions: `ci.yml` and `release-image.yml`

Sources: `.github/workflows/ci.yml` (205 lines), `.github/workflows/release-image.yml` (219 lines). Third-party actions are pinned by commit SHA with the major version in a comment.

## 1. `ci.yml`: verification only

Trigger: `push` on every branch and `pull_request` (`ci.yml:6-8`). Permissions `contents: read` (`:11-12`). Concurrency group `ci-${{ github.ref }}` with `cancel-in-progress: true` (`:14-16`). Header: "never deploys, never touches a real database and holds no cloud credentials" (`:1-4`).

Workflow environment (`:18-25`): `NEXT_PUBLIC_SITE_URL`, `AUTH_URL` (http://localhost:3000), `AUTH_TRUST_HOST`, throwaway `AUTH_SECRET` and `PAYLOAD_SECRET`, `FEATURE_LAB_BOOKING=false`. Not secrets: the strings are literal in the file.

### Job `static` (timeout 20 min, `:28-65`)

| Step | Command | Proves |
|---|---|---|
| install | `pnpm install --frozen-lockfile` | lockfile matches `package.json`; pnpm version from `packageManager` (`pnpm@10.33.0`) |
| Lint | `pnpm lint` (`eslint src tests`) | |
| Secret scan | `node scripts/scan-secrets.mjs` | seven credential shapes over `git ls-files` (file 10) |
| Design-token hardcode lint | `python3 scripts/lint_hardcodes.py src` | colours, lengths, durations in `src` come from `src/styles/tokens.css` |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`) | |
| Unit tests | `pnpm test` (`vitest run`) | all `src/**/*.test.ts` and `infra/**/*.test.ts`, including the CloudFormation text tests and release-gate tests (`vitest.config.mts:7`) |
| Security audit | `pnpm audit --prod --audit-level=moderate` | fails on moderate or above in runtime dependencies, except two GHSA ids ignored in `pnpm-workspace.yaml` (braces ReDoS, esbuild dev-server) |

### Job `integration` (timeout 40 min, `:67-115`)

Service container `postgres:16` with health command, `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/knest_test`, `PW_CHANNEL: chrome` (Chrome is preinstalled on the runner). Steps: install, `pnpm build`, `node scripts/check_bundle_budget.mjs`, `pnpm test:integration`. Details of the suite are in files 17 and 18. The build must precede the tests because `global-setup.ts:134` starts `next start` only when `.next/BUILD_ID` exists; if it does not, every test that calls `BASE()` throws `TEST_BASE_URL is not set` (`helpers.ts:5-9`), so a missing build fails loudly rather than skipping.

### Job `image` (timeout 45 min, `:117-205`)

See file 08 section 4.

### What `ci.yml` does not do

- No arm64 build, no deployment, no Terraform/CloudFormation validation (no `cfn-lint` or `validate-template` step; a `cfn-lint` run is reported clean in commit `fac5d49` per `RUNBOOK.md:9`, not in CI).
- No image scan: scanning happens in ECR at push time, in the release workflow.
- No required-check configuration is visible from the repository; whether branch protection requires CI is not determined from the code.
- Jobs run in parallel; they are independent.

Evidence of runs: `docs/delivery/EVIDENCE/ci-runs.md` records successes and the failures with causes (schema drift check without S3 variables, a CMS audit test user lacking a staff role).

## 2. `release-image.yml`: build, scan, push, deploy

Trigger `workflow_dispatch` only; inputs `environment` (choice `s1`, `production`) and `deploy` (boolean, default false) (`release-image.yml:18-29`). Permissions `contents: read`; concurrency group `release-${{ inputs.environment }}` with `cancel-in-progress: false` (`:31-36`), so two releases to one environment queue instead of racing.

### Job 1 `verify-source`: the exact-SHA CI gate (`:39-61`)

Permissions `actions: read`. The step queries:

```
gh api repos/$REPO/actions/workflows/ci.yml/runs?head_sha=$GITHUB_SHA&event=push&per_page=20 \
  --jq '.workflow_runs | sort_by(.created_at) | last'
```

then requires, with `jq -e`, `.head_sha == $GITHUB_SHA and .status == "completed" and .conclusion == "success"`. No run (empty or `null`) is an error, and the CI run URL is appended to the step summary.

Why it is shaped this way: it ties the release to the *commit being released*, not to "the branch is green". The latest run for the SHA is taken, so a later failing re-run overrides an earlier success.

Semantics and edge cases:

| Case | Result |
|---|---|
| Commit was pushed and CI passed | proceeds |
| Latest run for the SHA was cancelled (superseded by concurrency `cancel-in-progress`) | `conclusion` is `cancelled`, gate fails even if an earlier run passed. The `ref` concurrency group cancels in-flight runs on a new push to the same ref, but a SHA that was superseded has no later run for the same SHA, so the gate fails until someone re-runs CI for that SHA. |
| Commit reached the branch only through a merge made on GitHub (new SHA) | needs its own push-triggered run, which exists because `push` is on every branch |
| Commit exists only in a pull request, never pushed to a branch of this repo | no `push` run: gate fails. Pull-request runs are `event=pull_request` and are ignored by design. |
| Dispatch on a ref whose SHA has more than 20 runs | not handled; `per_page=20` after sort |
| Release workflow's own tests | `infra/cfn/release-gates.test.ts:8-16` asserts the `needs` edge and that the command text contains `head_sha=${GITHUB_SHA}`, `.head_sha == $sha`, `.conclusion == "success"`. It checks text, not behaviour. |

The gate does not re-run tests, and it trusts that CI built the same source: the image the release builds is not the image CI tested (different platform, different build run).

### Job 2 `build-and-push` (timeout 60 min, `:63-169`)

`needs: verify-source`, `environment: ${{ inputs.environment }}` (so reviewers apply and the OIDC `sub` includes the environment), permissions `id-token: write`. Outputs `app_image` and `migrate_image`.

Steps:

1. **Environment variable check** (`:76-84`): `AWS_REGION`, `AWS_PUSH_ROLE_ARN`, `ECR_REPOSITORY` must be non-empty, naming the missing one.
2. Checkout, Node 24, `node scripts/scan-secrets.mjs` (the secret scan runs again).
3. `aws-actions/configure-aws-credentials` assumes the push role with session name `knest-release-<run id>` (`:95-99`). `amazon-ecr-login` yields the registry (`:101-102`).
4. QEMU for arm64 and Buildx (`:104-108`).
5. Two `docker/build-push-action` steps (`:110-129`): target `runner` tagged `<registry>/<repo>:app-<sha>` and target `migrate` tagged `migrate-<sha>`, platform `linux/arm64`, `push: true`, `provenance: false`. `provenance: false` keeps the pushed object a single image manifest instead of an index with attestations; the comment says tags are immutable and "the deploy uses the digests". Why `provenance: false` matters for scanning and digest semantics is inferred, not documented in the file.
6. **Scan gate** `refs` (`:131-169`), for each of the two digests:
   1. up to 30 attempts, 10 s apart, run `aws ecr wait image-scan-complete --repository-name --image-id imageDigest=<digest>`; the waiter fails at once with `ScanNotFoundException` until ECR registers the scan, hence the retry (`:140-153`). After 5 minutes without completion: error, digest not accepted.
   2. `aws ecr describe-image-scan-findings ... --output json > scan-result.json`.
   3. Accept only if the `jq -e` expression is true (`:158`):

```
.imageScanStatus.status == "COMPLETE"
and ((.imageScanFindings.findingSeverityCounts // {})
     | (((.CRITICAL // 0) + (.HIGH // 0)) == 0))
```

   4. Only after both digests pass, write `app_image=<registry>/<repo>@<digest>` and `migrate_image=...` to `$GITHUB_OUTPUT` and a digest summary (`:163-169`).

#### The jq rule explained

- `status == "COMPLETE"` rejects scans that are `IN_PROGRESS`, `FAILED`, `UNSUPPORTED_IMAGE` or absent. "No usable result" fails closed.
- `findingSeverityCounts // {}` handles ECR omitting the object when a scan finds nothing. This was a real bug: an image with zero findings was previously rejected as "no usable result" (fixed in commit `3960b91`, `V1-DEPLOYMENT-REPORT.md:36`).
- `(.CRITICAL // 0) + (.HIGH // 0) == 0`: any critical or high finding fails; `MEDIUM`, `LOW`, `INFORMATIONAL` and `UNDEFINED` pass.
- Defaults inside `//` mean a missing key is zero only when the scan is `COMPLETE`.

Limits of the gate:

- It evaluates once, at release time. A vulnerability published after the push is not seen by a later deploy of the same digest, and a rollback to an older digest is not re-scanned.
- It relies on ECR's basic scanning at push (`ScanOnPush`). Which engine the repository uses (basic or enhanced) is not set in `ci.yaml`; not determined from the code.
- The jq expression is never executed against fixtures anywhere in the repository. `release-gates.test.ts:18-26` only checks that the step text mentions `aws ecr wait image-scan-complete`, `describe-image-scan-findings`, `(.CRITICAL // 0)` before the `echo "app_image=` line, and `(.HIGH // 0)` (D-11).
- The digest accepted is the one the build action reported (`steps.app.outputs.digest`), so what is scanned and deployed is the same artifact.

### Job 3 `deploy` (`:171-219`)

`if: ${{ inputs.deploy }}`, `needs: build-and-push`, environment-protected, timeout 30 min. Steps:

1. Check `AWS_DEPLOY_ROLE_ARN` is set.
2. Assume the deploy role (`knest-deploy-<run id>`).
3. `aws ssm send-command --document-name knest-$ENV-deploy --targets Key=tag:knest-deploy-target,Values=$ENV --parameters Environment=...,AppImage=...,MigrateImage=... --comment "release $GITHUB_SHA"` and capture `CommandId`.
4. Poll `list-command-invocations` up to 12 times, 5 s apart, for the instance ID; none means the tag or SSM registration is wrong (`:207-214`).
5. `aws ssm wait command-executed ... || true`, then `get-command-invocation` is printed and the step passes only if `Status == Success` (`:215-219`).

Hazard (D-14): the AWS CLI `command-executed` waiter has a bounded wait (documented as 5 s delay x 20 attempts, about 100 s; not verified in this environment) and its failure is swallowed by `|| true`. The deploy document itself waits for an RDS snapshot, runs migrations, pulls two images and waits up to 90 s for health (file 04), which can exceed 100 s. In that case the status read immediately afterwards is `InProgress`, the final test fails, and the job reports failure while the deploy completes on the host. The V1 reports describe a deploy checked by reading the SSM invocation directly (`V1-DEPLOYMENT-REPORT.md:109`), not a green workflow run; no hosted green run of this job is recorded in the files read.

### Properties of the whole release path

| Property | Mechanism |
|---|---|
| No long-lived AWS key in GitHub | OIDC, 1-hour sessions (`ci.yaml`) |
| Human approval for production | GitHub Environment required reviewers (configured outside the repo; unverified) |
| Immutable artifact reference | digest in SSM parameters, pattern-checked by the document |
| Source gate | exact-SHA CI success |
| Image gate | scan COMPLETE and no CRITICAL/HIGH in both images |
| Deploy atomicity | none: single host, outage during swap |
| Release is repeatable for a SHA | no, in practice: tags are immutable, and a rebuild of the same SHA is normally a different image (floating base, `apk upgrade`, timestamps), so ECR refuses the retag; inferred, not recorded |

### Failure modes

| Symptom | Cause |
|---|---|
| `verify-source` fails "No CI run exists" | commit never pushed to a branch; push first |
| `build-and-push` fails at push with a tag error | `app-<sha>` exists from an earlier run of the same SHA |
| Scan step: "No completed image scan ... after five minutes" | ECR scan not registered or still running; the tags already exist, so a re-dispatch for the same SHA is likely to be refused at push (inferred); re-reading the scan with `aws ecr describe-image-scan-findings` is the manual route |
| Deploy: "no host answered" | instance not tagged `knest-deploy-target`, SSM agent offline, or deploy role condition mismatched |
| Deploy step fails but host healthy | waiter timeout, D-14 |
