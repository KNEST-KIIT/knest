# E6.11 Operations scripts: cutover, hosted smoke, load test, drills, DNS compare

None of these scripts has a recorded hosted run. Status per script is given in each section. Line numbers are the files' own.

## 1. `scripts/ops/cutover-preflight.sh` (85 lines): read-only gate

`set -uo pipefail` (no `-e`, so every gate runs and reports). Each gate prints `PASS`/`FAIL name [detail]`; exit status is 1 if any failed, and the apply script refuses to continue (`cutover-apply.sh:20`).

| Gate | Check | Lines | What it proves | What it does not prove |
|---|---|---|---|---|
| G1 | `docs/delivery/EVIDENCE/hd-06-approval.md` exists, has `APPROVED-BY: ...@...` or `APPROVED-BY: <letters, 5+>` and `APPROVED-ON: 20YY-MM-DD`, and does not contain `DRAFT, NOT APPROVED` | `:26-32` | a file with the right shape was committed | that a KIIT approver wrote it; anyone with commit access can create it. The script comment says "signed by a named KIIT approver" but the check is textual. |
| G2 | SSM parameter `turnstile-site-key` is not one of Cloudflare's three published test keys and not empty | `:35-39` | the site key is a real one | the **secret** key (not inspected; `:38`). The V1 report records the secret as the always-pass test value (`V1-DEPLOYMENT-REPORT.md:39`); a real site key with a test secret is not detected. |
| G3 | an ACM certificate for `kiitnest.com` in us-east-1 is `ISSUED` and its SANs include `www.kiitnest.com`, `kiitnest.in`, `www.kiitnest.in` | `:42-50` | certificate ready | that CloudFront uses it; takes the first certificate returned for that domain name (`| [0]`), so a stale duplicate could be picked |
| G4 | SESv2 `VerifiedForSendingStatus` is True for `kiitnest.com` | `:53-54` | DKIM verified | production access (sandbox exit) is not checked, so mail to unverified recipients can still fail |
| G5 | SSM parameter `db-runtime-secret-arn` is non-empty | `:57-58` | the reference exists | that the running container uses it. The message tells the operator to confirm in the deploy log; the script cannot. (D-05) |
| G6 | the `knest-production-alerts` topic has at least one subscription that is not `PendingConfirmation` | `:61-67` | a confirmed subscriber exists | that an alarm reaches a person (DRILLS D6 NOT RUN) |
| G7 | hosted zone `kiitnest.com` exists, and `dns-compare.mjs kiitnest.com ns43.domaincontrol.com <first NS record of the zone> --ignore 'kiitnest.com|A,www.kiitnest.com|A,www.kiitnest.com|CNAME,NS'` exits 0 | `:70-81` | the zone mirrors GoDaddy for the six default names | other names; only the first Route 53 nameserver is queried, whereas the runbook requires all four (`DNS-MIGRATION.md:13`); `kiitnest.in` is not compared; the `NS` variable at `:72` is unused |

Notes:

- G7's `RNS` query takes the first `ResourceRecords[0].Value` of `Type=='NS'` record sets: that is the zone's NS record at the apex, whose first value is one of the four delegated servers. OK in practice; it also picks up any NS record set in the zone (e.g. a delegated subdomain) first in listing order. Not an issue with the current template (no subdomain NS).
- G1-G7 are labelled "hard gates (none of these can be waived by this script or by an engineer)" (`:8-9`); that is a statement of intent. The apply script's check is the exit code, which a person with shell access can bypass by running the `aws` commands directly.
- Required permissions: `ssm:GetParameter`, `acm:List*/Describe*`, `sesv2:Get*`, `sns:List*`, `route53:List*/Get*`; all present in `infra/iam/operator-policy.json:58-110`.
- Windows: `MSYS_NO_PATHCONV=1` is exported (`:17`); PYTHONUTF8 is documented in the header for the AWS CLI's output encoding.

## 2. `scripts/ops/cutover-apply.sh` (70 lines): `aliases` and `public` stages

Always runs the preflight first (`:18-20`, `CERT_ARN` is looked up before it, so a missing certificate produces `None` in the variable rather than an early stop). `set -euo pipefail`.

Helper `changeset stack region name args...` (`:26-35`): `create-change-set`, wait for create, print `Action LogicalResourceId Replacement`, **execute immediately**, wait for update complete. There is no confirmation between display and execution, so the printed diff is evidence, not a gate (see H-1 in file 02: an AMI drift replacement would be executed). `prev_params` lists existing parameter keys so that all except the ones being changed use `UsePreviousValue=true` (`:22-24`).

Stage `aliases` (`:38-44`): edge stack in us-east-1, parameters `Aliases=kiitnest.com,www.kiitnest.com,kiitnest.in,www.kiitnest.in` and `AcmCertificateArn=<found cert>`, `--use-previous-template`. Effects: the distribution accepts the four hostnames; DNS is not changed; the access gate stays.

Stage `public` (`:46-65`):

1. App stack (ap-south-1): `SiteUrl=https://kiitnest.com`, `SiteIndexing=on`, with `CAPABILITY_NAMED_IAM CAPABILITY_IAM`. Prints a reminder to redeploy the container (the stack update only changes SSM parameters; it does not restart anything).
2. DNS stack (us-east-1): `CloudFrontDomainName=<distribution domain>`; creates the web aliases in Route 53, which are inert until nameservers move.
3. Manual: owner changes GoDaddy nameservers. A prompt waits for `YES`; any other answer leaves the gate and exits 0.
4. Edge stack: `AccessHash=` empty. Removes the preview gate.
5. Prints the `verify-production.mjs` command to run.

Failure modes and gaps:

| Issue | Detail |
|---|---|
| `prev_params ... 2>/dev/null` on the dns stack (`:54`) | if the stack does not exist the pipeline yields no parameters and `create-change-set` for a non-existent stack with `--use-previous-template` fails; the script has `set -e` so it stops after stage 1 has already executed. A half-applied cutover (SiteUrl switched, container not yet redeployed) is possible. |
| Order dependency | SiteUrl changes before the container is redeployed, and the container reads it only at deploy: until the operator runs the redeploy, the app still has the old `SITE_URL`. With the previous value being the CloudFront address, form posts from `https://kiitnest.com` are refused (origin mismatch) until redeploy. |
| `ParameterKey=Aliases,ParameterValue=a\,b` | commas escaped for the CLI; works with the CLI's shorthand syntax. |
| Gate removal is irreversible only by redeploy | rollback needs the hash, kept outside the repository (`CUTOVER-RUNBOOK.md:65`). |
| The origin DNS record | not handled (file 07, D-08). |
| Stack names, regions | literals (`:42,47,55,62`). |

Status: never executed (`CUTOVER-RUNBOOK.md:1-3`: "prepared, NOT executed").

## 3. `scripts/ops/hosted-smoke-remote.sh` and `scripts/hosted-smoke.mjs`

### Remote runner (75 lines)

Takes the migrate image digest as `$1` (required; the header at `:10-11` says it can be found "by the release tag convention", the code exits 2 if absent: `:18-22`, a stale comment, D-15). Finds the running instance by tag, base64-encodes `scripts/hosted-smoke.mjs` (`base64 -w0`, GNU only; macOS `base64` lacks `-w`), builds an inline script with `__ENVIRONMENT__`, `__IMAGE__`, `__PAYLOAD__` substituted, wraps it as `{"commands":[...],"executionTimeout":["600"]}` and sends it with `AWS-RunShellScript`. The remote script:

1. reads region and parameters as in the deploy document;
2. writes the payload to `mktemp -d /run/knest-smoke.XXXXXX` (removed on exit), umask 077;
3. reads the **runtime** secret if the parameter exists, otherwise the master (`:40-41`), builds `smoke.env` with `DATABASE_URL`, `DATABASE_SSL=verify`, CA file, `SITE_URL`, `ORIGIN_VERIFY_SECRET`;
4. logs in to ECR and runs `docker run --rm --network host --env-file ... -v <CA> -v <script> -w /app <migrate image> node hosted-smoke.mjs`.

Why the migrate image: it contains `pg` and `bcryptjs` (full dependency tree). Why `--network host`: the script talks to `127.0.0.1:3000`. Polls for up to 450 s (90 x 5 s) and returns exit 0 only if the invocation `Status == Success`.

The account ID is hard-coded in a comment (`:7`). The script grants itself nothing: it needs `ssm:SendCommand` on `AWS-RunShellScript`, which the operator policy allows (`operator-policy.json:43-56`) and which, with the tag condition `IfExists`, applies to any instance carrying the production tag.

### The smoke journey (`hosted-smoke.mjs`, 219 lines)

Calls the real HTTP routes of the running container with forged `x-origin-verify` and `cloudfront-viewer-address` headers (`:51-56`), and uses the database only to create a staff account, mark e-mail verified and read results.

| Step | Lines |
|---|---|
| health 200 | `:79-80` |
| insert staff user directly (`super_admin`) | `:83-88` |
| sign up through the API; student row exists, starts unverified | `:91-101` |
| mark verified in the DB (mail cannot be read back), student and staff sign in, `/admin` is 404 for the student and 200 for staff | `:102-115` |
| staff creates an open published program with a text and a file question through `/api/programs` | `:118-141` |
| program page renders; student starts application; answer saved; PDF uploaded to S3; document row recorded; submitted | `:143-179` |
| staff list and detail render, document downloads (200 or 302), status moves to under review; student dashboard renders; student cannot change a status | `:181-193` |
| anonymous enquiry accepted | `:195-200` |
| cleanup: program closed and unpublished, the two accounts deactivated | `:201-208` |

It leaves in place: one application, one document row and S3 object, one enquiry, a closed program, two deactivated users (`OPERATOR-COMMANDS.md:12`).

What it would establish if run: instance-role S3 write from the real container, RDS TLS verification, runtime-role privileges against real RDS, origin-verify handling, WAF is **not** in the path (loopback).

**Known defect (D-16):** the script sends the literal captcha token `smoke-token` (`:76`). The application verifies the token with Cloudflare when `TURNSTILE_SECRET_KEY` is set (`src/server/security/turnstile.ts:30-47`). Against Cloudflare's always-pass test secret that passes; once real Turnstile keys are installed (required by gate G2 before launch), sign-up, login, submit and enquiry will be `rejected`, and the smoke fails at its first write step. The script therefore works only in the interim state in which the production secret is the test value. After the real keys are installed the smoke needs a different technique (a temporary verify override is not available in production: `TURNSTILE_VERIFY_URL` exists for tests, `turnstile.ts:38`).

Other limits: it sets `Origin`/`Host` from `SITE_URL` itself, so a `SITE_URL` mismatch with the real browser origin is not caught; the WAF, CloudFront function and ALB are not exercised.

## 4. `scripts/ops/load-test.mjs` (137 lines)

Dependency-free Node 20+; round-robin over nine anonymous GET paths (`/`, `/programs`, `/events`, `/mentors`, `/blog`, `/about`, `/contact`, `/login`, `/api/health`) (`:31`), fixed request counts, redirects not followed (`redirect: 'manual'`).

| Profile | Concurrency | Requests | p95 limit | Max error rate |
|---|---|---|---|---|
| `smoke` | 5 | 200 | 1500 ms | 0 |
| `d7` | 20 | 6000 | 1500 ms | 0.1% |
| `peak` | 50 | 5000 | 1200 ms | 0.5% |
| `stress` | 100 | 10000 | 3000 ms | 2% |

Fail (exit 1) on error rate, p95, or any 429 (`:56-62`). A 3xx counts as an answer; any status at or above 400 is an error (`:97-98`). Safety: refuses any non-loopback, non-RFC1918 host unless `LOAD_TEST_ALLOW_REMOTE=1`, which needs the release owner's written approval (`:15-17`, `:74-77`). Exit 2 for bad usage. Writes JSON with `--json=`.

Limits: the hostname check uses only a literal-IP regex, so a private DNS name resolving to a private address is treated as remote; `localhost` and `::1` are the only names accepted. Behind CloudFront every request has one viewer address (`LOAD-TEST.md:56-60`). Latency thresholds are proposals (`LOAD-TEST.md:36`). Status: exercised only against a trivial local stub (`LOAD-TEST.md:3-6`); drill D7 is NOT RUN.

## 5. `scripts/drills/populated-upgrade.mts` (66 lines): drill D1

Starts a throwaway PostgreSQL 16 via `tests/support/pg.ts` (embedded, or `TEST_DATABASE_URL`), copies `src/db/migrations` to a temp folder with the journal truncated by the last N entries (default 1), applies it ("previous release"), seeds 200 users and 50 enquiries, applies the full set, and prints a table: counts equal, 12 of 12 migrations recorded, a sample row's bcrypt hash intact, a second run is a no-op. Exit 1 on any `FAIL`.

Result recorded 2026-10-11 at `codex/production-v1` (`DRILLS.md:5-18`). Limits: Drizzle migrations only (Payload migrations in `cms` are not part of it); two tables counted; synthetic data without production volume, constraints or bloat; a migration that lengthens a table lock is not measured; only the last N migrations are treated as "new".

## 6. `scripts/dns-compare.mjs` (+ `scripts/lib/dns-compare-core.mjs`)

Queries two nameservers **directly** (resolver set to their IPs, `timeout 4000 ms, tries 2`) for six default names (`<domain>`, `www.`, `_dmarc.`, `google._domainkey.`, `dc-bdaca08905._spfm.`, `_domainconnect.`) plus `--names` extras, for types A, AAAA, CNAME, MX, TXT, NS. Normalises (lower-case, trailing dot, sort, TXT chunks joined) and diffs. `--ignore` takes keys `name|TYPE`, a bare `TYPE`, or `name|*`. Exit 1 on any difference. `ENODATA`/`ENOTFOUND` count as empty answers; other errors abort. Unit tests: `infra/dns/dns-compare.test.ts`.

Caveat: `defaultNames` hard-codes the GoDaddy-specific SPF include label `dc-bdaca08905._spfm` (`dns-compare-core.mjs:50`), so it is meaningful for `kiitnest.com` only; for `kiitnest.in` that name will be absent on both sides (equal, vacuous). The documented use `--ignore ...|NS` hides the NS difference, which is expected.
